import { test } from "node:test";
import assert from "node:assert";
import "./regions.js"; // sets globalThis.RegionSearch
const { haystack, REGIONS } = globalThis.RegionSearch;

test("haystack: includes region label (EN + JA)", () => {
  const h = haystack("Kanto");
  assert.ok(h.includes("kanto"));
  assert.ok(h.includes("関東"));
});

test("haystack: includes prefectures (romaji + kanji)", () => {
  const h = haystack("Kyushu-Okinawa");
  assert.ok(h.includes("okinawa"), "romaji prefecture");
  assert.ok(h.includes("沖縄"), "kanji prefecture");
  assert.ok(h.includes("fukuoka"));
  assert.ok(h.includes("福岡"));
});

test("haystack: a prefecture maps to the right region", () => {
  assert.ok(haystack("Kansai").includes("osaka"), "Osaka is in Kansai");
  assert.ok(haystack("Kansai").includes("大阪"));
  assert.ok(!haystack("Kanto").includes("osaka"), "Osaka is not in Kanto");
});

test("haystack: lowercased so search is case-insensitive", () => {
  assert.strictEqual(haystack("Hokkaido"), haystack("Hokkaido").toLowerCase());
  assert.ok(haystack("Hokkaido").includes("hokkaido"));
});

test("haystack: unknown / missing group falls back to Other (no throw)", () => {
  const h = haystack("Nonexistent");
  assert.ok(h.includes("other"));
  assert.strictEqual(haystack(undefined), haystack("Other"));
});

test("haystack: National and BS groups carry sensible terms", () => {
  assert.ok(haystack("National").includes("全国"));
  assert.ok(haystack("BS / Satellite").includes("bs"));
});

test("REGIONS covers all 47 prefectures exactly once", () => {
  const all = Object.values(REGIONS).flatMap((r) => r.prefectures.map((p) => p[0]));
  assert.strictEqual(all.length, 47, "47 prefectures total");
  assert.strictEqual(new Set(all).size, 47, "no duplicates");
});
