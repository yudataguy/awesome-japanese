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
// A channel's uploads playlist (UC... -> UU...) CANNOT be swapped reliably at
// runtime via loadPlaylist()/cuePlaylist() — those silently no-op on uploads
// playlists. Construction-time playlists ARE reliable, so we (re)create the
// player per channel with the playlist in playerVars. loadVideoById() IS
// reliable, so it serves as the exact-resume fallback when a channel has posted
// a newer video since the saved position.
let apiReady = false;
let ytPlayer = null;
let channelsReady = false;
let initDone = false;
let pendingInit = null;          // {channel, chip, autoplay} picked before the API loaded
let defaultPick = null;          // {channel, chip} default selection from render()
let activeChannelId = null;
let saveTimer = null;
const channelById = {};
const chipById = {};

function ytList(channelId) { return "UU" + channelId.slice(2); }

// YouTube calls this global when the IFrame API has loaded.
window.onYouTubeIframeAPIReady = function () {
  apiReady = true;
  flushPending();
  maybeInit();
};

// A pick made before the API finished loading wins over the default/restore.
function flushPending() {
  if (!pendingInit || !apiReady) return;
  const p = pendingInit; pendingInit = null;
  initDone = true;
  mountChannel(p.channel, p.autoplay);
}

function maybeInit() {
  if (!apiReady || !channelsReady || initDone) return;
  // Fresh load: restore the last-watched channel cued/paused at its saved spot;
  // otherwise default to the first live channel (latest), also cued.
  const lastId = window.Resume.lastChannelId();
  const restore = lastId && channelById[lastId];
  if (restore) {
    initDone = true;
    selectChip(restore, chipById[lastId]);
    mountChannel(restore, false);
  } else if (defaultPick) {
    initDone = true;
    selectChip(defaultPick.channel, defaultPick.chip);
    mountChannel(defaultPick.channel, false);
  }
}

// (Re)create the player for a channel. autoplay=true plays (user gesture);
// false cues (paused). Resumes the saved video + time when one is stored.
function mountChannel(channel, autoplay) {
  activeChannelId = channel.youtubeChannelId;
  if (saveTimer) { clearInterval(saveTimer); saveTimer = null; }

  const saved = window.Resume.get(channel.youtubeChannelId);
  const vars = {
    listType: "playlist",
    list: ytList(channel.youtubeChannelId),
    index: 0,
    autoplay: autoplay ? 1 : 0,
    playsinline: 1,
    rel: 0,
    origin: window.location.origin,
  };
  if (saved) vars.start = saved.seconds; // resume time on the first (newest) upload

  try { if (ytPlayer) ytPlayer.destroy(); } catch (e) { /* ignore */ }
  // Reset the player slot with safe DOM methods (no innerHTML).
  const frame = document.querySelector(".player-frame");
  frame.replaceChildren();
  const slot = document.createElement("div");
  slot.id = "player";
  frame.appendChild(slot);
  ytPlayer = new YT.Player("player", {
    host: "https://www.youtube.com",
    playerVars: vars,
    events: {
      onReady: function () {
        // If the newest upload is no longer the saved video (a new one was
        // posted), resume the exact saved video instead — loadVideoById works
        // where loadPlaylist does not.
        if (!saved) return;
        try {
          const vid = ytPlayer.getVideoData().video_id;
          if (vid && vid !== saved.videoId) {
            if (autoplay) ytPlayer.loadVideoById({ videoId: saved.videoId, startSeconds: saved.seconds });
            else ytPlayer.cueVideoById({ videoId: saved.videoId, startSeconds: saved.seconds });
          }
        } catch (e) { /* ignore */ }
      },
      onStateChange: onPlayerStateChange,
    },
  });
}

function saveCurrent() {
  if (!activeChannelId || !ytPlayer) return;
  try {
    const vd = ytPlayer.getVideoData();
    const t = ytPlayer.getCurrentTime();
    if (vd && vd.video_id && t > 0) window.Resume.save(activeChannelId, vd.video_id, t);
  } catch (e) { /* ignore */ }
}

function onPlayerStateChange(e) {
  if (e.data === YT.PlayerState.PLAYING) {
    if (!saveTimer) saveTimer = setInterval(saveCurrent, 5000);
  } else {
    if (saveTimer) { clearInterval(saveTimer); saveTimer = null; }
    if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) saveCurrent();
  }
}

document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") saveCurrent();
});
window.addEventListener("pagehide", saveCurrent);

function selectChip(channel, chipEl) {
  npMode.textContent = window.Resume.get(channel.youtubeChannelId) ? "⏮ Resumed" : "⏭ Latest";
  npName.textContent = channel.name;
  if (selectedChip) selectedChip.classList.remove("selected");
  if (chipEl) { chipEl.classList.add("selected"); selectedChip = chipEl; }
}

function play(channel, chipEl, autoplay) {
  selectChip(channel, chipEl);
  if (apiReady) { initDone = true; mountChannel(channel, autoplay); }
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
      channelById[ch.youtubeChannelId] = ch;
      chipById[ch.youtubeChannelId] = chip;
      if (!firstChip) { firstChip = chip; firstChannel = ch; }
      if (!firstLiveChip && ch.hasLive) { firstLiveChip = chip; firstLiveChannel = ch; }
      chips.appendChild(chip);
    }
    section.append(h, chips);
    rail.appendChild(section);
  }

  // First load: default to a channel that runs live (its uploads are reliably
  // embeddable worldwide), else the first valid channel. The actual cue is
  // deferred to maybeInit() so it waits for the IFrame player API to be ready.
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
