// Simulated-live TV: each channel plays a clock-anchored schedule of its
// uploads (schedule.json, generated server-side). "What's on now" is computed
// from a fixed epoch + the wall clock; tuning in seeks to that live offset.

let apiReady = false;
let ytPlayer = null;
let schedule = null;          // parsed schedule.json
let activeChannelId = null;
let selectedChip = null;
let pendingTune = null;       // channelId picked before the API was ready
let currentIndex = -1;        // index of the item the player is on (for error skipping)
let errorStreak = 0;          // consecutive load errors, to avoid infinite skip loops

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

function selectChip(channelId, chipEl) {
  if (selectedChip) selectedChip.classList.remove("selected");
  if (chipEl) { chipEl.classList.add("selected"); selectedChip = chipEl; }
}

function makeChip(channelId, ch) {
  const chip = document.createElement("div");
  chip.className = "chip";
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = ch.name;
  const btn = document.createElement("button");
  btn.className = "latest";
  btn.textContent = "● Tune in";
  btn.setAttribute("aria-label", "Tune in to " + ch.name);
  btn.addEventListener("click", () => { selectChip(channelId, chip); tune(channelId, true); });
  chip.append(name, btn);
  return chip;
}

function render() {
  const ids = Object.keys(schedule.channels);
  if (!ids.length) { showError(); return; }
  const section = document.createElement("div");
  section.className = "rail-group";
  const h = document.createElement("h2"); h.textContent = "Live Channels";
  const chips = document.createElement("div"); chips.className = "chips";
  let firstId = null, firstChip = null;
  for (const id of ids) {
    const chip = makeChip(id, schedule.channels[id]);
    if (!firstId) { firstId = id; firstChip = chip; }
    chips.appendChild(chip);
  }
  section.append(h, chips);
  rail.appendChild(section);
  // Auto-tune the first channel, cued (no autoplay until a click).
  selectChip(firstId, firstChip);
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
