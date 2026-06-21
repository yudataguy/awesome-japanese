// tv/resume.js — per-channel 24h resume storage for the /tv/ player.
// Works in the browser (window.Resume) and under node (module.exports) for tests.
(function () {
  "use strict";
  var KEY = "tvResume";
  var TTL_MS = 24 * 60 * 60 * 1000;

  function isExpired(savedAt, now) {
    return typeof savedAt !== "number" || (now - savedAt) >= TTL_MS;
  }

  // Returns a NEW map with only non-expired entries.
  function prune(map, now) {
    var out = {};
    if (map && typeof map === "object") {
      for (var id in map) {
        if (Object.prototype.hasOwnProperty.call(map, id)) {
          var e = map[id];
          if (e && !isExpired(e.savedAt, now)) out[id] = e;
        }
      }
    }
    return out;
  }

  // storage: object with getItem/setItem (window.localStorage or a mock).
  // nowFn: optional () => ms (injected for tests).
  function makeResume(storage, nowFn) {
    var now = nowFn || function () { return Date.now(); };

    function readMap() {
      try {
        var raw = storage.getItem(KEY);
        var parsed = raw ? JSON.parse(raw) : {};
        return (parsed && typeof parsed === "object") ? parsed : {};
      } catch (e) { return {}; }
    }
    function writeMap(map) {
      try { storage.setItem(KEY, JSON.stringify(map)); } catch (e) { /* ignore */ }
    }

    return {
      get: function (channelId) {
        var map = prune(readMap(), now());
        writeMap(map);
        var e = map[channelId];
        return e ? { videoId: e.videoId, seconds: e.seconds } : null;
      },
      save: function (channelId, videoId, seconds) {
        if (!channelId || !videoId) return;
        var map = prune(readMap(), now());
        map[channelId] = {
          videoId: videoId,
          seconds: Math.max(0, Math.floor(seconds || 0)),
          savedAt: now(),
        };
        writeMap(map);
      },
      clear: function (channelId) {
        var map = readMap();
        delete map[channelId];
        writeMap(map);
      },
      lastChannelId: function () {
        var map = prune(readMap(), now());
        writeMap(map);
        var bestId = null, bestAt = -1;
        for (var id in map) {
          if (Object.prototype.hasOwnProperty.call(map, id) && map[id].savedAt > bestAt) {
            bestAt = map[id].savedAt; bestId = id;
          }
        }
        return bestId;
      },
    };
  }

  var api = { isExpired: isExpired, prune: prune, makeResume: makeResume };
  // Expose the pure API on globalThis (works in the browser and in node ESM tests).
  if (typeof globalThis !== "undefined") globalThis.ResumeLib = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  // In the browser, also expose a ready-to-use instance backed by localStorage.
  if (typeof window !== "undefined") {
    try {
      window.Resume = makeResume(window.localStorage);
    } catch (e) {
      window.Resume = makeResume({ getItem: function () { return null; }, setItem: function () {} });
    }
  }
})();
