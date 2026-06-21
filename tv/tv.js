// Simulated-live TV: each channel plays a clock-anchored schedule of its
// uploads (schedule.json, generated server-side). "What's on now" is computed
// from a fixed epoch + the wall clock; tuning in seeks to that live offset.

let apiReady = false;
let ytPlayer = null;
let schedule = null;          // parsed schedule.json
let activeChannelId = null;
let pendingTune = null;       // channelId picked before the API was ready
let currentIndex = -1;        // index of the item the player is on (for error skipping)
let errorStreak = 0;          // consecutive load errors, to avoid infinite skip loops

const GROUP_ORDER = ["National", "BS / Satellite", "Hokkaido", "Tohoku", "Kanto", "Chubu", "Kansai", "Chugoku", "Shikoku", "Kyushu-Okinawa"];
const GROUP_LABELS_JA = {
  "National": "全国", "BS / Satellite": "BS・衛星", "Hokkaido": "北海道",
  "Tohoku": "東北", "Kanto": "関東", "Chubu": "中部", "Kansai": "関西",
  "Chugoku": "中国", "Shikoku": "四国", "Kyushu-Okinawa": "九州・沖縄", "Other": "その他",
};
let activeIconEl = null;      // the currently-selected icon element
let activeName = "";          // active channel name (restored after hover)

const npName = document.getElementById("np-name");
const npMode = document.getElementById("np-mode");
const rail = document.getElementById("rail");
const errorBox = document.getElementById("error");

function nowSeconds() { return Math.floor(Date.now() / 1000); }

window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player("player", {
    host: "https://www.youtube.com",
    playerVars: { playsinline: 1, rel: 0, origin: window.location.origin },
    events: {
      onReady: function () { apiReady = true; if (pendingTune) { const c = pendingTune; pendingTune = null; tune(c, true); } },
      onStateChange: onStateChange,
      onError: onError,
    },
  });
};

function onStateChange(e) {
  if (e.data === YT.PlayerState.PLAYING) errorStreak = 0; // a real play clears the streak
  if (e.data === YT.PlayerState.ENDED && activeChannelId) tune(activeChannelId, true); // advance to live program
}

// A dead/private/unembeddable video fires onError (not ENDED). Walk forward
// through the schedule from the item we're actually on (currentIndex), one step
// per error, until something plays. Give up after a full lap so a channel whose
// items are all unplayable doesn't loop forever.
function onError() {
  if (!activeChannelId || !ytPlayer) return;
  const ch = schedule.channels[activeChannelId];
  if (!ch || !ch.items.length) return;
  errorStreak++;
  if (errorStreak > ch.items.length) { npMode.textContent = "⚠ Unavailable"; return; }
  currentIndex = (currentIndex + 1) % ch.items.length;
  ytPlayer.loadVideoById({ videoId: ch.items[currentIndex].videoId, startSeconds: 0 });
}

// Load whatever is "on now" for a channel and seek to the live offset.
function tune(channelId, autoplay) {
  const ch = schedule.channels[channelId];
  if (!ch) return;
  activeChannelId = channelId;
  npName.textContent = ch.name;
  npMode.textContent = "● Live";
  const prog = globalThis.ScheduleLib.currentProgram(ch, schedule.epoch, nowSeconds());
  if (!prog) return;
  if (!apiReady) { pendingTune = channelId; return; }
  currentIndex = prog.index;
  errorStreak = 0;
  const opts = { videoId: prog.videoId, startSeconds: prog.offset };
  if (autoplay) ytPlayer.loadVideoById(opts); else ytPlayer.cueVideoById(opts);
}

function selectIcon(channelId, el) {
  if (activeIconEl) activeIconEl.classList.remove("on");
  if (el) { el.classList.add("on"); activeIconEl = el; }
  activeName = (schedule.channels[channelId] || {}).name || "";
}

function applyInitials(btn, name) {
  const lib = globalThis.IconLib;
  btn.classList.add("initials");
  btn.style.setProperty("--hue", lib.hueFromString(name));
  btn.textContent = lib.initials(name);
}

function iconEl(channelId, ch) {
  const btn = document.createElement("button");
  btn.className = "sicon";
  btn.type = "button";
  btn.title = ch.name;
  btn.setAttribute("aria-label", "Tune in to " + ch.name);
  if (ch.icon) {
    const img = document.createElement("img");
    img.src = ch.icon; img.alt = ""; img.loading = "lazy";
    img.addEventListener("error", () => { img.remove(); applyInitials(btn, ch.name); });
    btn.appendChild(img);
  } else {
    applyInitials(btn, ch.name);
  }
  btn.addEventListener("click", () => { selectIcon(channelId, btn); tune(channelId, true); });
  btn.addEventListener("mouseenter", () => { npName.textContent = ch.name; });
  btn.addEventListener("mouseleave", () => { npName.textContent = activeName; });
  btn.addEventListener("focus", () => { npName.textContent = ch.name; });
  btn.addEventListener("blur", () => { npName.textContent = activeName; });
  return btn;
}

function render() {
  const ids = Object.keys(schedule.channels);
  if (!ids.length) { showError(); return; }
  const groups = {};
  for (const id of ids) {
    const g = schedule.channels[id].group;
    const key = GROUP_ORDER.includes(g) ? g : "Other";
    (groups[key] ||= []).push(id);
  }
  const order = [...GROUP_ORDER.filter((g) => groups[g]), ...(groups["Other"] ? ["Other"] : [])];
  let firstId = null, firstEl = null;
  for (const key of order) {
    const section = document.createElement("div");
    section.className = "rail-group";
    const h = document.createElement("h2"); h.textContent = key;
    const ja = GROUP_LABELS_JA[key];
    if (ja) { const s = document.createElement("span"); s.className = "ja"; s.textContent = ja; h.append(" ", s); }
    const grid = document.createElement("div"); grid.className = "icon-grid";
    for (const id of groups[key]) {
      const el = iconEl(id, schedule.channels[id]);
      if (!firstId) { firstId = id; firstEl = el; }
      grid.appendChild(el);
    }
    section.append(h, grid);
    rail.appendChild(section);
  }
  // Auto-tune the first channel, cued (no autoplay until a click).
  selectIcon(firstId, firstEl);
  tune(firstId, false);
}

function showError() {
  errorBox.hidden = false;
  // Static literal only — never interpolate user/JSON data here (XSS).
  errorBox.innerHTML = 'Could not load the schedule. See the <a href="../tv.md">Markdown TV guide</a> instead.';
}

// Detect region (no filtering yet) — fire and forget.
if (window.Region) window.Region.detectCountry().then((cc) => { window.__viewerCountry = cc; });

fetch("schedule.json")
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((data) => { if (!data || !data.channels) throw new Error("empty"); schedule = data; render(); })
  .catch(showError);
