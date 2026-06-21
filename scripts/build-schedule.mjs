import { parseDuration } from "./duration.mjs";

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
    channels[ch.channelId] = { name: ch.name, total, items };
  }
  return { epoch, generatedAt, channels };
}

const EPOCH = 1700000000; // FIXED — never change; keeps the shared clock continuous.
const MAX_ITEMS = 40;     // recent uploads per channel (window)
// Embeddable news channels. The "main" broadcaster channels (NHK, 日テレ公式,
// TBS公式, フジ, テレ東) DISABLE embedded playback (YouTube error 150), so they
// can't be used here; these news channels allow embedding. status.embeddable is
// still checked per video below as a safety net.
const CHANNELS = [
  { channelId: "UCGCZAYq5Xxojl_tSXcVJhiQ", name: "ANN News (TV Asahi)" },
  { channelId: "UC6AG81pAkf6Lbi_1VC5NmPA", name: "TBS NEWS DIG" },
  { channelId: "UCuTAXTexrhetbOe3zgskJBQ", name: "日テレNEWS" },
  { channelId: "UCoQBJMzcwmXrRSHBFAlTsIw", name: "FNNプライムオンライン" },
  { channelId: "UCNsidkYpIAQ4QaufptQBPHQ", name: "ウェザーニュース" },
];
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
        isoDuration: v.contentDetails?.duration || "",
        regionRestriction: v.contentDetails?.regionRestriction,
        embeddable: v.status?.embeddable,
      };
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

  // 1) Fetch each channel's recent uploads + details.
  const raw = [];
  for (const ch of CHANNELS) {
    const ids = (await uploadIds(ch.channelId, key)).reverse(); // oldest -> newest
    const details = await videoDetails(ids, key);
    // If an id was deleted/privated between the two calls, details[id] is
    // undefined → the spread is a no-op → no isoDuration → dropped by .filter. OK.
    const videos = ids.map((id) => ({ videoId: id, ...details[id] })).filter((v) => v.isoDuration);
    raw.push({ channelId: ch.channelId, name: ch.name, videos });
  }

  // 2) Drop Shorts. Orientation is unavailable in CI (see note above), so
  // keepVideo() applies its duration-floor fallback.
  const channelsData = raw.map((ch) => ({
    channelId: ch.channelId,
    name: ch.name,
    videos: ch.videos.filter((v) => keepVideo(parseDuration(v.isoDuration), undefined)),
  }));

  const schedule = buildSchedule(channelsData, EPOCH, Math.floor(Date.now() / 1000));
  const { writeFileSync } = await import("node:fs");
  writeFileSync(outPath, JSON.stringify(schedule));
  console.log(`Wrote ${outPath}: ${Object.keys(schedule.channels).length} channels`);
}

// Run main() only when invoked directly (not when imported by tests).
import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
