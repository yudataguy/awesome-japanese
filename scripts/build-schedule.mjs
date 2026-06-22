import { parseDuration } from "./duration.mjs";
import { readFileSync, writeFileSync } from "node:fs";

// Pure: fetched per-channel data -> schedule.json object.
export function buildSchedule(channelsData, epoch, generatedAt) {
  const channels = {};
  for (const ch of channelsData) {
    const items = [];
    for (const v of ch.videos) {
      if (v.embeddable === false) continue; // owner disabled embedding (YT error 150)
      const duration = parseDuration(v.isoDuration);
      if (duration <= 0) continue; // unusable (live/upcoming/0) -> skip
      const rr = v.regionRestriction || {};
      items.push({
        videoId: v.videoId,
        title: v.title || "",
        duration,
        blocked: Array.isArray(rr.blocked) ? rr.blocked : [],
        allowed: Array.isArray(rr.allowed) ? rr.allowed : [],
      });
    }
    if (!items.length) continue;
    const total = items.reduce((s, it) => s + it.duration, 0);
    channels[ch.channelId] = { name: ch.name, group: ch.group || "", total, items };
  }
  return { epoch, generatedAt, channels };
}

// Pure: combine a primary channel's videos with sub-channel video arrays into
// one publishedAt-sorted list (oldest->newest), capping each source independently.
// Inputs are oldest->newest (as fetchVideos produces). Missing/invalid publishedAt
// sorts as oldest (epoch 0); ties break by insertion order (stable).
export function mergeSources(primaryVideos, subVideoArrays, { maxPrimary, maxSub }) {
  const ts = (x) => { const t = Date.parse(x && x.publishedAt); return Number.isNaN(t) ? 0 : t; };
  const newest = (arr, n) => (n >= arr.length ? arr.slice() : arr.slice(arr.length - n));
  const tagged = [];
  for (const x of newest(primaryVideos, maxPrimary)) tagged.push([x, ts(x), tagged.length]);
  for (const sub of subVideoArrays) for (const x of newest(sub, maxSub)) tagged.push([x, ts(x), tagged.length]);
  tagged.sort((a, b) => (a[1] - b[1]) || (a[2] - b[2]));
  return tagged.map((t) => t[0]);
}

const EPOCH = 1700000000; // FIXED — never change; keeps the shared clock continuous.
const MAX_ITEMS = 40;     // recent uploads per channel (window)
const SUB_MAX_ITEMS = 18; // per sub-channel cap so news doesn't flood the merge
// All channels come from the directory (tv/channels.json). Embeddability is
// per-video (even "main" broadcasters mix embeddable + error-150 uploads), so
// it's filtered per video via status.embeddable below — not per channel.
// Channels that yield fewer than MIN_ITEMS playable items are dropped.
const MIN_ITEMS = 4;
const CHANNELS = JSON.parse(readFileSync(new URL("../tv/channels.json", import.meta.url), "utf8"))
  .channels.map((c) => ({ channelId: c.youtubeChannelId, extraIds: c.extraChannelIds || [], name: c.name, group: c.group }));
const API = "https://www.googleapis.com/youtube/v3";
const SHORTS_DURATION_MAX = 180; // only videos this short can be Shorts; skip the check for longer ones

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

// Recent upload video IDs (newest-first from API), trimmed to MAX_ITEMS.
async function uploadIds(channelId, key) {
  const list = "UU" + channelId.slice(2);
  const url = `${API}/playlistItems?part=contentDetails&maxResults=${MAX_ITEMS}&playlistId=${list}&key=${key}`;
  const d = await getJson(url);
  return (d.items || []).map((i) => i.contentDetails.videoId);
}

// title + duration + regionRestriction + embeddable for up to 50 ids per call.
async function videoDetails(ids, key) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50).join(",");
    const url = `${API}/videos?part=snippet,contentDetails,status&id=${batch}&key=${key}`;
    const d = await getJson(url);
    for (const v of d.items || []) {
      out[v.id] = {
        title: v.snippet?.title || "",
        publishedAt: v.snippet?.publishedAt || "",
        isoDuration: v.contentDetails?.duration || "",
        regionRestriction: v.contentDetails?.regionRestriction,
        embeddable: v.status?.embeddable,
      };
    }
  }
  return out;
}

// Channel avatar URLs, mapped by channel id (≤50/call).
async function channelIcons(ids, key) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50).join(",");
    const d = await getJson(`${API}/channels?part=snippet&id=${batch}&key=${key}`);
    for (const c of d.items || []) {
      const t = c.snippet?.thumbnails || {};
      out[c.id] = (t.medium || t.default || {}).url || "";
    }
  }
  return out;
}

const SHORTS_FALLBACK_MAX = 60; // when orientation is unknown, treat <= this as a Short

// Pure: should a video be kept (not a Short)? orientation is "vertical" |
// "landscape" | undefined (yt-dlp couldn't classify it).
//   - duration <= 0           -> drop (unusable: live/upcoming)
//   - duration > SHORTS_MAX   -> keep (too long to be a Short)
//   - vertical                -> drop (confirmed Short)
//   - landscape               -> keep (confirmed normal video)
//   - unknown                 -> duration floor: drop only the very short ones
export function keepVideo(durationSeconds, orientation) {
  if (durationSeconds <= 0) return false;
  if (durationSeconds > SHORTS_DURATION_MAX) return true;
  if (orientation === "vertical") return false;
  if (orientation === "landscape") return true;
  return durationSeconds > SHORTS_FALLBACK_MAX;
}

// NOTE on Shorts: accurate aspect-ratio detection requires the watch page /
// InnerTube / yt-dlp, all of which YouTube bot-blocks from datacenter (CI) IPs.
// So orientation is left unknown in CI and keepVideo() falls back to a duration
// floor (drop <= 60s), which removes the great majority of Shorts. If a
// residential-IP orientation source is ever available, pass it as the second
// keepVideo() arg to get exact filtering.

async function main() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY not set");
  const outArg = process.argv.indexOf("--out");
  const outPath = outArg > -1 ? process.argv[outArg + 1] : "tv/schedule.json";

  // 1) Fetch each channel's recent uploads + details (limited concurrency).
  async function fetchVideos(channelId) {
    const ids = (await uploadIds(channelId, key)).reverse(); // oldest -> newest
    const details = await videoDetails(ids, key);
    // Deleted/privated between calls → details[id] undefined → no isoDuration → dropped.
    return ids.map((id) => ({ videoId: id, ...details[id] })).filter((v) => v.isoDuration);
  }
  async function fetchChannel(ch) {
    try {
      const primary = await fetchVideos(ch.channelId);
      const subs = [];
      for (const ex of ch.extraIds) subs.push(await fetchVideos(ex));
      const videos = ch.extraIds.length
        ? mergeSources(primary, subs, { maxPrimary: MAX_ITEMS, maxSub: SUB_MAX_ITEMS })
        : primary;
      return { channelId: ch.channelId, name: ch.name, group: ch.group, videos };
    } catch (e) {
      console.warn(`fetch failed: ${ch.name}: ${e.message}`);
      return { channelId: ch.channelId, name: ch.name, group: ch.group, videos: [] };
    }
  }
  const raw = [];
  const CONC = 6;
  for (let i = 0; i < CHANNELS.length; i += CONC) {
    raw.push(...(await Promise.all(CHANNELS.slice(i, i + CONC).map(fetchChannel))));
  }

  // 2) Drop Shorts (duration floor; orientation unavailable in CI, see note).
  const channelsData = raw.map((ch) => ({
    channelId: ch.channelId,
    name: ch.name,
    group: ch.group,
    videos: ch.videos.filter((v) => keepVideo(parseDuration(v.isoDuration), undefined)),
  }));

  // 3) Build, log every channel's playable count, drop those below MIN_ITEMS.
  const full = buildSchedule(channelsData, EPOCH, Math.floor(Date.now() / 1000));
  const rows = CHANNELS.map((c) => [c.name, full.channels[c.channelId]?.items.length || 0]).sort((a, b) => a[1] - b[1]);
  console.log("Per-channel playable items (after embeddable + Shorts filter):");
  for (const [n, k] of rows) console.log(`  ${k < MIN_ITEMS ? "DROP" : "keep"} ${String(k).padStart(3)}  ${n}`);
  const kept = {};
  for (const [id, c] of Object.entries(full.channels)) if (c.items.length >= MIN_ITEMS) kept[id] = c;

  // Attach each kept channel's avatar (mapped by id; omitted -> "").
  const icons = await channelIcons(Object.keys(kept), key);
  for (const id of Object.keys(kept)) kept[id].icon = icons[id] || "";

  const schedule = { ...full, channels: kept };

  writeFileSync(outPath, JSON.stringify(schedule));
  console.log(`Wrote ${outPath}: ${Object.keys(kept).length}/${CHANNELS.length} channels kept (>=${MIN_ITEMS} items)`);
}

// Run main() only when invoked directly (not when imported by tests).
import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
