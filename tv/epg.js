// tv/epg.js — EPG of channel rows × horizontal time (NOW line, click-to-tune).
(function () {
  "use strict";
  const PPMx = 6;                 // pixels per minute (horizontal)
  const PXS = PPMx / 60;          // pixels per second
  const PAST_SEC = 1800;          // 30 min of past shown on the left
  const WINDOW_SEC = 3 * 3600;    // total window (30 min past + 2.5 h future)
  const ROW_H = 48;
  const CHCOL_W = 156;            // sticky left channel column
  const HEAD_H = 25;
  const MIN_W = 24;
  const TRACK_W = WINDOW_SEC * PXS;

  function el(cls) { const d = document.createElement("div"); d.className = cls; return d; }
  function hhmm(sec) { const d = new Date(sec * 1000); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

  let lastContainer = null;

  function chcell(id, ch, app) {
    const cell = el("epg-chcell"); cell.style.width = CHCOL_W + "px"; cell.style.height = ROW_H + "px";
    const no = el("epg-chno"); no.textContent = app.chNo[id] || ""; cell.appendChild(no);
    if (ch.icon) {
      const img = document.createElement("img"); img.className = "epg-chicon"; img.src = ch.icon; img.alt = ""; img.loading = "lazy";
      img.addEventListener("error", () => { img.remove(); cell.insertBefore(initialsIcon(ch.name), meta); });
      cell.appendChild(img);
    } else { cell.appendChild(initialsIcon(ch.name)); }
    const meta = el("epg-chmeta");
    const nm = el("epg-chname"); nm.textContent = ch.name;
    const gn = el("epg-chgenre"); gn.textContent = ch.group || "";
    meta.append(nm, gn); cell.appendChild(meta);
    return cell;
  }
  function initialsIcon(name) {
    const d = el("epg-chicon initials");
    d.style.setProperty("--hue", globalThis.IconLib.hueFromString(name));
    d.textContent = globalThis.IconLib.initials(name);
    return d;
  }

  function render(container) {
    const app = window.TVApp;
    const sched = app && app.getSchedule();
    if (!sched || !sched.channels) return;
    lastContainer = container;
    const Sched = globalThis.ScheduleLib;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - PAST_SEC;
    const cc = app.getCountry();
    const hideRegion = window.Settings.store.read().hideRegion;

    container.replaceChildren();
    const inner = el("epg-inner");
    inner.style.width = (CHCOL_W + TRACK_W) + "px";

    // header: spacer + time labels
    const head = el("epg-head");
    const spacer = el("epg-head-spacer"); spacer.style.width = CHCOL_W + "px"; spacer.style.height = HEAD_H + "px";
    const times = el("epg-times"); times.style.width = TRACK_W + "px";
    for (let t = Math.ceil(windowStart / 1800) * 1800; t < windowStart + WINDOW_SEC; t += 1800) {
      const lab = el("epg-time"); lab.style.left = ((t - windowStart) * PXS) + "px"; lab.textContent = hhmm(t);
      times.appendChild(lab);
    }
    head.append(spacer, times); inner.appendChild(head);

    // rows
    for (const id of app.order) {
      const ch = sched.channels[id];
      const row = el("epg-row"); row.dataset.id = id; row.dataset.name = (ch.name || "").toLowerCase();
      row.style.height = ROW_H + "px";

      // region filter: hide if current program not viewable in cc
      if (hideRegion && cc) {
        const cur = Sched.currentProgram(ch, sched.epoch, now);
        const item = cur && ch.items[cur.index];
        if (item && !Sched.viewableInCountry(item, cc)) row.classList.add("region-off");
      }

      row.appendChild(chcell(id, ch, app));
      const track = el("epg-track"); track.style.width = TRACK_W + "px"; track.style.height = ROW_H + "px";
      const progs = Sched.programsInWindow(ch, sched.epoch, windowStart, WINDOW_SEC);
      for (const p of progs) {
        const b = document.createElement("button");
        b.className = "epg-prog" + (p.start <= now && now < p.end ? " live" : "");
        b.type = "button"; b.title = p.title; b.dataset.title = (p.title || "").toLowerCase();
        const left = Math.max(0, (p.start - windowStart) * PXS);
        const right = Math.min(TRACK_W, (p.end - windowStart) * PXS);
        b.style.left = left + "px"; b.style.width = Math.max(MIN_W, right - left) + "px";
        b.textContent = p.title;
        b.addEventListener("click", () => app.tune(id));
        b.addEventListener("mouseenter", () => app.updateInfo(id));
        b.addEventListener("mouseleave", () => app.updateInfo(app.getActive()));
        track.appendChild(b);
      }
      row.appendChild(track);
      inner.appendChild(row);
    }

    // NOW line across the rows
    const nowLine = el("epg-now");
    nowLine.style.left = (CHCOL_W + PAST_SEC * PXS) + "px";
    nowLine.style.top = HEAD_H + "px";
    inner.appendChild(nowLine);

    container.appendChild(inner);
    applySearch(app.getQuery ? app.getQuery() : "");
    markActive(app.getActive ? app.getActive() : null);
  }

  function applySearch(query) {
    const lib = globalThis.IconLib;
    if (!lastContainer) return;
    let any = false;
    lastContainer.querySelectorAll(".epg-row").forEach((row) => {
      let match = lib.matches(query, row.dataset.name);
      row.querySelectorAll(".epg-prog").forEach((b) => {
        const hit = !!query && lib.matches(query, b.dataset.title);
        b.classList.toggle("match", hit);
        if (hit) match = true;
      });
      row.classList.toggle("search-off", !!query && !match);
      if (!row.classList.contains("region-off") && !row.classList.contains("search-off")) any = true;
    });
  }

  function markActive(id) {
    if (!lastContainer) return;
    lastContainer.querySelectorAll(".epg-row.on").forEach((r) => r.classList.remove("on"));
    if (id) { const row = lastContainer.querySelector('.epg-row[data-id="' + id + '"]'); if (row) row.classList.add("on"); }
  }

  function refilter() { if (lastContainer) render(lastContainer); }

  if (typeof window !== "undefined") window.EPG = { render, filter: applySearch, refilter, markActive };
})();
