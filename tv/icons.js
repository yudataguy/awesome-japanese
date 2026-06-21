// tv/icons.js — pure helpers for the station-icon fallback.
(function () {
  "use strict";
  function initials(name) {
    if (!name || typeof name !== "string") return "?";
    const cleaned = name.replace(/^【[^】]*】\s*/, "").replace(/^[\s\[（(]+/, "").trim();
    if (!cleaned) return "?";
    const cjk = /[　-鿿＀-￯]/.test(cleaned[0]);
    return cleaned.slice(0, cjk ? 2 : 3);
  }
  function hueFromString(s) {
    let h = 0;
    for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }
  // Case-insensitive substring match; empty query matches everything.
  function matches(query, text) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    return String(text || "").toLowerCase().includes(q);
  }

  const api = { initials, hueFromString, matches };
  if (typeof globalThis !== "undefined") globalThis.IconLib = api;
})();
