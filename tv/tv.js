const GROUP_ORDER = ["National", "BS / Satellite", "Hokkaido", "Tohoku", "Kanto", "Chubu", "Kansai", "Chugoku", "Shikoku", "Kyushu-Okinawa"];

function liveLink(channelId) {
  // Opens the channel's current live broadcast on YouTube (or its "not live" page).
  return "https://www.youtube.com/channel/" + channelId + "/live";
}

const npMode = document.getElementById("np-mode");
const npName = document.getElementById("np-name");
const rail = document.getElementById("rail");
const errorBox = document.getElementById("error");

let selectedChip = null;

function isValidChannel(channel) {
  return channel && typeof channel.youtubeChannelId === "string"
    && channel.youtubeChannelId.startsWith("UC");
}

// --- YouTube IFrame Player API ---------------------------------------------
let ytPlayer = null;
let ytReady = false;
let channelsReady = false;
let initDone = false;
let pendingInit = null;   // {channel, chip, autoplay} chosen before the player was ready
let defaultPick = null;   // {channel, chip} default selection from render()
let activeChannelId = null;

function ytList(channelId) { return "UU" + channelId.slice(2); }

// YouTube calls this global when the IFrame API has loaded.
window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player("player", {
    host: "https://www.youtube.com",
    playerVars: { playsinline: 1, rel: 0, origin: window.location.origin },
    events: {
      onReady: function () { ytReady = true; flushPending(); maybeInit(); },
      onStateChange: onPlayerStateChange,
    },
  });
};

// If the user clicked a channel before the API finished loading, that pick wins
// over the default/restore init.
function flushPending() {
  if (!pendingInit || !ytReady) return;
  const p = pendingInit; pendingInit = null;
  initDone = true;
  startChannel(p.channel, p.autoplay);
}

// Poll getPlaylist() until the playlist window is populated (no dedicated event).
function whenPlaylistReady(cb) {
  let tries = 0;
  (function check() {
    let list = null;
    try { list = ytPlayer.getPlaylist(); } catch (e) {}
    if (list && list.length) return cb(list);
    if (tries++ < 25) setTimeout(check, 100); // ~2.5s budget
  })();
}

// autoplay=true → load & play (user gesture). false → cue (paused).
// NOTE: this parity version is REPLACED by the resume-aware version in Task 4.
function startChannel(channel, autoplay) {
  activeChannelId = channel.youtubeChannelId;
  const opts = { list: ytList(channel.youtubeChannelId), listType: "playlist", index: 0 };
  if (autoplay) ytPlayer.loadPlaylist(opts);
  else ytPlayer.cuePlaylist(opts);
}

function onPlayerStateChange() { /* filled in Task 3 */ }

function maybeInit() {
  if (!ytReady || !channelsReady || initDone || !defaultPick) return;
  initDone = true;
  play(defaultPick.channel, defaultPick.chip, false); // cue default (paused), like today
}

function play(channel, chipEl, autoplay) {
  npMode.textContent = "⏭ Latest";
  npName.textContent = channel.name;
  if (selectedChip) selectedChip.classList.remove("selected");
  if (chipEl) { chipEl.classList.add("selected"); selectedChip = chipEl; }
  if (ytReady) startChannel(channel, autoplay);
  else pendingInit = { channel: channel, chip: chipEl, autoplay: autoplay };
}

function makeChip(channel) {
  const chip = document.createElement("div");
  chip.className = "chip";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = channel.name;

  const net = document.createElement("div");
  net.className = "net";
  net.textContent = channel.network + (channel.note ? " · " + channel.note : "");

  const btns = document.createElement("div");
  btns.className = "btns";

  const latestBtn = document.createElement("button");
  latestBtn.className = "latest";
  latestBtn.textContent = "⏭ Latest";
  latestBtn.setAttribute("aria-label", "Play " + channel.name + " latest uploads");
  latestBtn.addEventListener("click", () => play(channel, chip, true));
  btns.appendChild(latestBtn);

  // Channels that run live streams get a link that opens the live on YouTube
  // (embedding their live isn't possible without an API key).
  if (channel.hasLive) {
    const live = document.createElement("a");
    live.className = "live-link";
    live.href = liveLink(channel.youtubeChannelId);
    live.target = "_blank";
    live.rel = "noopener";
    live.textContent = "▶ Live ↗";
    live.setAttribute("aria-label", "Open " + channel.name + " live on YouTube (new tab)");
    btns.appendChild(live);
  }

  chip.append(name, net, btns);
  return chip;
}

function render(channels) {
  const valid = channels.filter(c => {
    if (!isValidChannel(c)) { console.warn("Skipping channel with invalid youtubeChannelId:", c); return false; }
    return true;
  });
  if (valid.length === 0) { showError(); return; }

  const groups = {};
  for (const ch of valid) (groups[ch.group || "National"] ||= []).push(ch);
  const orderedKeys = [
    ...GROUP_ORDER.filter(g => groups[g]),
    ...Object.keys(groups).filter(g => !GROUP_ORDER.includes(g)),
  ];

  let firstChannel = null, firstChip = null;
  let firstLiveChannel = null, firstLiveChip = null;

  for (const key of orderedKeys) {
    const section = document.createElement("div");
    section.className = "rail-group";
    const h = document.createElement("h2"); h.textContent = key;
    const chips = document.createElement("div"); chips.className = "chips";
    for (const ch of groups[key]) {
      const chip = makeChip(ch);
      if (!firstChip) { firstChip = chip; firstChannel = ch; }
      if (!firstLiveChip && ch.hasLive) { firstLiveChip = chip; firstLiveChannel = ch; }
      chips.appendChild(chip);
    }
    section.append(h, chips);
    rail.appendChild(section);
  }

  // First load: default to a channel that runs live (its uploads are reliably
  // embeddable worldwide), else the first valid channel. The actual cue/play is
  // deferred to maybeInit() so it waits for the IFrame player to be ready.
  channelsReady = true;
  defaultPick = firstLiveChannel
    ? { channel: firstLiveChannel, chip: firstLiveChip }
    : (firstChannel ? { channel: firstChannel, chip: firstChip } : null);
  maybeInit();
}

function showError() {
  errorBox.hidden = false;
  // Static literal only — never interpolate user/JSON data here (XSS).
  errorBox.innerHTML = 'Could not load the channel list. See the <a href="../tv.md">Markdown TV guide</a> instead.';
}

fetch("channels.json")
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(data => {
    if (!data || !Array.isArray(data.channels) || data.channels.length === 0) throw new Error("empty");
    render(data.channels);
  })
  .catch(showError);
