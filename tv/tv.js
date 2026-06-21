// Unified TV app: clock-anchored simulated-live playback in a full-viewport
// shell (video + info + EPG rows + status bar). "What's on now" comes from a
// fixed epoch + the wall clock; tuning seeks to that live offset.

let apiReady = false;
let ytPlayer = null;
let schedule = null;          // parsed schedule.json
let activeChannelId = null;
let pendingTune = null;       // channelId picked before the API was ready
let currentIndex = -1;        // index of the item the player is on (error skipping)
let errorStreak = 0;          // consecutive load errors, to bound the skip loop

const GROUP_ORDER = ["National", "BS / Satellite", "Hokkaido", "Tohoku", "Kanto", "Chubu", "Kansai", "Chugoku", "Shikoku", "Kyushu-Okinawa"];
const GROUP_LABELS_JA = {
  "National": "全国", "BS / Satellite": "BS・衛星", "Hokkaido": "北海道",
  "Tohoku": "東北", "Kanto": "関東", "Kansai": "関西", "Chubu": "中部",
  "Chugoku": "中国", "Shikoku": "四国", "Kyushu-Okinawa": "九州・沖縄", "Other": "その他",
};
const INFO_WINDOW = 3 * 3600;

let order = [];               // channel ids in display order (region groups)
let chNo = {};                // channelId -> 1-based number (stable, pre-filter)
let query = "";               // current search query (lowercased)

const infoEl = document.getElementById("info");
const errorBox = document.getElementById("error");

function nowSeconds() { return Math.floor(Date.now() / 1000); }
function hhmm(sec) {
  const d = new Date(sec * 1000);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function el(cls) { const d = document.createElement("div"); d.className = cls; return d; }

window.onYouTubeIframeAPIReady = function () { createPlayer(); };

function createPlayer() {
  const controls = window.Settings.store.read().controls ? 1 : 0;
  ytPlayer = new YT.Player("player", {
    host: "https://www.youtube.com",
    playerVars: { playsinline: 1, rel: 0, controls: controls, origin: window.location.origin },
    events: {
      onReady: function () { apiReady = true; if (pendingTune) { const c = pendingTune; pendingTune = null; tune(c, true); } },
      onStateChange: onStateChange,
      onError: onError,
    },
  });
}

// Rebuild the player (controls is fixed at creation). Re-seek to the live offset
// via the existing pendingTune/onReady path.
function rebuildPlayer() {
  apiReady = false;
  pendingTune = activeChannelId;
  try { if (ytPlayer) ytPlayer.destroy(); } catch (e) {}
  ytPlayer = null;
  const frame = document.querySelector(".player-frame");
  frame.replaceChildren();
  const div = document.createElement("div"); div.id = "player"; frame.appendChild(div);
  createPlayer();
}

function onStateChange(e) {
  if (e.data === YT.PlayerState.PLAYING) errorStreak = 0;
  if (e.data === YT.PlayerState.ENDED && activeChannelId) tune(activeChannelId, true);
}

// A dead/private/unembeddable video fires onError (not ENDED). Walk forward from
// the item we're on, one step per error, until something plays; give up after a
// full lap so an all-unplayable channel doesn't loop forever.
function onError() {
  if (!activeChannelId || !ytPlayer) return;
  const ch = schedule.channels[activeChannelId];
  if (!ch || !ch.items.length) return;
  errorStreak++;
  if (errorStreak > ch.items.length) { setMode("⚠ Unavailable"); return; }
  currentIndex = (currentIndex + 1) % ch.items.length;
  ytPlayer.loadVideoById({ videoId: ch.items[currentIndex].videoId, startSeconds: 0 });
}

function setMode(text) {
  const m = infoEl.querySelector(".info-mode");
  if (m) m.textContent = text;
}

// Load whatever is "on now" for a channel and seek to the live offset.
function tune(channelId, autoplay) {
  const ch = schedule.channels[channelId];
  if (!ch) return;
  activeChannelId = channelId;
  updateInfo(channelId);
  highlightActiveRow(channelId);
  const prog = globalThis.ScheduleLib.currentProgram(ch, schedule.epoch, nowSeconds());
  if (!prog) return;
  if (!apiReady) { pendingTune = channelId; return; }
  currentIndex = prog.index;
  errorStreak = 0;
  const opts = { videoId: prog.videoId, startSeconds: prog.offset };
  if (autoplay) ytPlayer.loadVideoById(opts); else ytPlayer.cueVideoById(opts);
}

// Fill the top-right info panel for a channel (current program + next).
function updateInfo(channelId) {
  const ch = schedule.channels[channelId];
  if (!ch) return;
  const now = nowSeconds();
  const progs = globalThis.ScheduleLib.programsInWindow(ch, schedule.epoch, now, INFO_WINDOW);
  const cur = progs[0], next = progs[1];

  infoEl.replaceChildren();
  const head = el("info-head");
  if (ch.icon) {
    const img = document.createElement("img"); img.className = "info-avatar"; img.src = ch.icon; img.alt = "";
    img.addEventListener("error", () => img.remove());
    head.appendChild(img);
  }
  const mode = el("info-mode"); mode.textContent = "● Live"; head.appendChild(mode);

  const name = el("info-name"); name.textContent = ch.name;
  const title = el("info-title"); title.textContent = cur ? "「" + cur.title + "」" : "—";
  const meta = el("info-meta");
  const range = cur ? hhmm(cur.start) + " – " + hhmm(cur.end) : "";
  meta.textContent = range + "　・　Ch " + (chNo[channelId] || "?") + "　・　" + (ch.group || "");
  infoEl.append(head, name, title, meta);
  if (next) { const n = el("info-next"); n.textContent = "NEXT 次 →　" + next.title; infoEl.appendChild(n); }
}

// Build channel display order (region groups) and assign stable 1-based numbers.
function buildOrder() {
  const ids = Object.keys(schedule.channels);
  const groups = {};
  for (const id of ids) {
    const g = schedule.channels[id].group;
    const key = GROUP_ORDER.includes(g) ? g : "Other";
    (groups[key] ||= []).push(id);
  }
  const keys = [...GROUP_ORDER.filter((g) => groups[g]), ...(groups["Other"] ? ["Other"] : [])];
  order = [];
  for (const k of keys) for (const id of groups[k]) order.push(id);
  chNo = {};
  order.forEach((id, i) => { chNo[id] = i + 1; });
}

function highlightActiveRow(channelId) {
  if (window.EPG && window.EPG.markActive) window.EPG.markActive(channelId);
}

// Shared API for epg.js.
function getSchedule() { return schedule; }
window.TVApp = {
  tune, getSchedule, GROUP_ORDER, GROUP_LABELS_JA,
  get order() { return order; }, get chNo() { return chNo; },
  getCountry: () => window.__viewerCountry || "",
  getQuery: () => query, getActive: () => activeChannelId,
  updateInfo,
};

// Status-bar + guide controls (search, hide-guide, mute, fullscreen).
function wireControls() {
  const app = document.getElementById("app");
  const guidebar = document.getElementById("guidebar");
  const search = document.getElementById("tv-search");
  const muteBtn = document.getElementById("sb-mute");
  const fullBtn = document.getElementById("sb-full");

  function updateGuidebarLabel() {
    guidebar.textContent = app.classList.contains("guide-hidden")
      ? "⌃  SHOW GUIDE  番組表をひらく" : "⌄  HIDE GUIDE  番組表をたたむ";
  }
  function toggleGuide() { app.classList.toggle("guide-hidden"); updateGuidebarLabel(); }

  if (window.Settings.store.read().guideHidden) app.classList.add("guide-hidden");
  updateGuidebarLabel();
  guidebar.addEventListener("click", toggleGuide);
  document.addEventListener("keydown", (e) => {
    const t = document.activeElement && document.activeElement.tagName;
    if (e.key === "g" && t !== "INPUT" && t !== "TEXTAREA") toggleGuide();
  });

  if (search) search.addEventListener("input", () => { query = search.value.trim().toLowerCase(); window.EPG.filter(query); });

  if (muteBtn) muteBtn.addEventListener("click", () => {
    if (!ytPlayer || !ytPlayer.isMuted) return;
    if (ytPlayer.isMuted()) { ytPlayer.unMute(); muteBtn.textContent = "🔊"; }
    else { ytPlayer.mute(); muteBtn.textContent = "🔇"; }
  });
  if (fullBtn) fullBtn.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (app.requestFullscreen) app.requestFullscreen();
  });
}

// CRT start screen: the click is the user gesture that unlocks autoplay WITH
// sound. On start, power on a random channel.
function wireStartScreen() {
  const ss = document.getElementById("start-screen");
  if (!ss) return;
  let started = false;
  function start() {
    if (started) return; started = true;
    const id = order[Math.floor(Math.random() * order.length)];
    try { if (ytPlayer && ytPlayer.unMute) ytPlayer.unMute(); } catch (e) {}
    tune(id, true); // autoplay with sound
    ss.classList.add("hide");
    setTimeout(() => { ss.hidden = true; }, 600);
  }
  ss.addEventListener("click", start);
  ss.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(); } });
}

function showError() {
  errorBox.hidden = false;
  errorBox.innerHTML = 'Could not load the schedule. See the <a href="../tv.md">Markdown TV guide</a> instead.';
}

// Apply a setting change to the running app (called after Settings persists it).
function onSettingChange(key, value) {
  if (key === "theme") window.Theme.apply(value);
  else if (key === "controls") rebuildPlayer();
  else if (key === "hideRegion") window.EPG.refilter();
  // guideHidden affects the next load only (per spec); already persisted.
}

// ---- Boot ----
window.Theme.apply(window.Settings.store.read().theme);
if (window.Region) window.Region.detectCountry().then((cc) => {
  window.__viewerCountry = cc;
  window.Settings.setRegionNote(cc);
  if (window.EPG && window.EPG.refilter) window.EPG.refilter();
});

fetch("schedule.json")
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((data) => {
    if (!data || !data.channels) throw new Error("empty");
    schedule = data;
    buildOrder();
    if (window.EPG && window.EPG.render) window.EPG.render(document.getElementById("epg"));
    const first = order[0];
    updateInfo(first);
    tune(first, false);
    wireControls();
    wireStartScreen();
    window.Settings.initUI({ onChange: onSettingChange });
  })
  .catch(showError);
