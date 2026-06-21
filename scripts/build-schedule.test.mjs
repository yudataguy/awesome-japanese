import { test } from "node:test";
import assert from "node:assert";
import { buildSchedule, keepVideo } from "./build-schedule.mjs";

test("keepVideo: drops zero/negative duration", () => {
  assert.strictEqual(keepVideo(0, "landscape"), false);
});
test("keepVideo: keeps long videos regardless of orientation", () => {
  assert.strictEqual(keepVideo(600, undefined), true);
  assert.strictEqual(keepVideo(600, "vertical"), true); // >180 can't be a Short
});
test("keepVideo: drops confirmed vertical Shorts", () => {
  assert.strictEqual(keepVideo(100, "vertical"), false);
  assert.strictEqual(keepVideo(30, "vertical"), false);
});
test("keepVideo: keeps confirmed landscape clips even if short", () => {
  assert.strictEqual(keepVideo(38, "landscape"), true);
});
test("keepVideo: unknown orientation -> duration floor (drop <=60s)", () => {
  assert.strictEqual(keepVideo(30, undefined), false); // likely a Short
  assert.strictEqual(keepVideo(90, undefined), true);  // probably a real clip
});

const channelsData = [
  { channelId: "UCaaa", name: "Chan A", videos: [
    { videoId: "v1", title: "One", isoDuration: "PT1M", regionRestriction: undefined },
    { videoId: "v2", title: "Two", isoDuration: "PT2M", regionRestriction: { blocked: ["US"] } },
  ]},
];

test("buildSchedule shapes schedule.json", () => {
  const out = buildSchedule(channelsData, 1700000000, 1782000000);
  assert.strictEqual(out.epoch, 1700000000);
  assert.strictEqual(out.generatedAt, 1782000000);
  const c = out.channels["UCaaa"];
  assert.strictEqual(c.name, "Chan A");
  assert.strictEqual(c.total, 180);
  assert.deepStrictEqual(c.items[0], { videoId: "v1", title: "One", duration: 60, blocked: [], allowed: [] });
  assert.deepStrictEqual(c.items[1], { videoId: "v2", title: "Two", duration: 120, blocked: ["US"], allowed: [] });
});

test("buildSchedule drops non-embeddable videos (status.embeddable === false)", () => {
  const out = buildSchedule([{ channelId: "UCe", name: "E", videos: [
    { videoId: "ok", title: "ok", isoDuration: "PT2M", embeddable: true },
    { videoId: "no", title: "no", isoDuration: "PT2M", embeddable: false },
    { videoId: "unknown", title: "u", isoDuration: "PT2M" }, // undefined -> kept (fail-open)
  ]}], 1700000000, 1);
  assert.deepStrictEqual(out.channels["UCe"].items.map((i) => i.videoId), ["ok", "unknown"]);
});

test("buildSchedule drops zero-duration items", () => {
  const out = buildSchedule([{ channelId: "UCz", name: "Z", videos: [
    { videoId: "good", title: "g", isoDuration: "PT30S" },
    { videoId: "bad", title: "b", isoDuration: "P0D" },
  ]}], 1700000000, 1);
  assert.strictEqual(out.channels["UCz"].items.length, 1);
  assert.strictEqual(out.channels["UCz"].total, 30);
});
