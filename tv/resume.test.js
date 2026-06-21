import { test } from "node:test";
import assert from "node:assert";
import "./resume.js"; // classic-script IIFE; sets globalThis.ResumeLib as a side effect
const { isExpired, prune, makeResume } = globalThis.ResumeLib;

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

test("isExpired: false just under 24h", () => {
  const now = 1000 * DAY;
  assert.strictEqual(isExpired(now - (DAY - 1000), now), false);
});
test("isExpired: true at or over 24h", () => {
  const now = 1000 * DAY;
  assert.strictEqual(isExpired(now - DAY, now), true);
  assert.strictEqual(isExpired(now - (DAY + 1000), now), true);
});
test("isExpired: true for non-number savedAt", () => {
  assert.strictEqual(isExpired(undefined, 1000), true);
});
test("prune drops expired, keeps fresh", () => {
  const now = 1000 * DAY;
  const map = {
    fresh: { videoId: "a", seconds: 10, savedAt: now - HOUR },
    old: { videoId: "b", seconds: 20, savedAt: now - (DAY + HOUR) },
  };
  assert.deepStrictEqual(Object.keys(prune(map, now)), ["fresh"]);
});

function mockStorage() {
  let s = {};
  return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
  };
}

test("save/get round-trip floors seconds", () => {
  const t = 1000 * DAY;
  const r = makeResume(mockStorage(), () => t);
  r.save("ch1", "vid1", 42.7);
  assert.deepStrictEqual(r.get("ch1"), { videoId: "vid1", seconds: 42 });
});
test("get returns null after >24h", () => {
  let t = 1000 * DAY;
  const r = makeResume(mockStorage(), () => t);
  r.save("ch1", "vid1", 42);
  t += DAY + 1000;
  assert.strictEqual(r.get("ch1"), null);
});
test("lastChannelId returns most recently saved non-expired", () => {
  let t = 1000 * DAY;
  const r = makeResume(mockStorage(), () => t);
  r.save("ch1", "v1", 5); t += HOUR;
  r.save("ch2", "v2", 5);
  assert.strictEqual(r.lastChannelId(), "ch2");
});
test("clear removes one entry", () => {
  const t = 1000 * DAY;
  const r = makeResume(mockStorage(), () => t);
  r.save("ch1", "v1", 5);
  r.clear("ch1");
  assert.strictEqual(r.get("ch1"), null);
});
test("corrupt JSON is treated as empty", () => {
  const t = 1000 * DAY;
  const store = { getItem: () => "{not json", setItem: () => {} };
  const r = makeResume(store, () => t);
  assert.strictEqual(r.get("ch1"), null);
});
