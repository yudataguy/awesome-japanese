// share.js — native Web Share (phone share sheet) with a desktop link fallback.
// Wires every .share-btn; each lives in a .share-wrap beside its .share-menu and
// carries data-url/data-title/data-text (falling back to the page).
(function () {
  "use strict";
  const enc = encodeURIComponent;

  function wire(btn) {
    const wrap = btn.closest(".share-wrap");
    const menu = wrap ? wrap.querySelector(".share-menu") : null;
    const url = btn.dataset.url || location.href;
    const title = btn.dataset.title || document.title;
    const text = btn.dataset.text || title;

    function buildMenu() {
      if (!menu || menu.dataset.built) return;
      menu.dataset.built = "1";
      const items = [
        ["✉️ Email", "mailto:?subject=" + enc(title) + "&body=" + enc(text + "\n" + url)],
        ["💬 Message", "sms:?&body=" + enc(text + " " + url)],
        ["𝕏 Post on X", "https://twitter.com/intent/tweet?text=" + enc(text) + "&url=" + enc(url)],
        ["f Facebook", "https://www.facebook.com/sharer/sharer.php?u=" + enc(url)],
      ];
      for (const [label, href] of items) {
        const a = document.createElement("a");
        a.href = href; a.textContent = label; a.target = "_blank"; a.rel = "noopener";
        menu.appendChild(a);
      }
      const copy = document.createElement("button");
      copy.type = "button"; copy.textContent = "🔗 Copy link";
      copy.addEventListener("click", () => {
        const done = () => { copy.textContent = "✓ Copied"; setTimeout(() => { copy.textContent = "🔗 Copy link"; }, 1500); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(() => {});
      });
      menu.appendChild(copy);
    }

    btn.addEventListener("click", (e) => {
      if (navigator.share) { navigator.share({ title, text, url }).catch(() => {}); return; }
      e.stopPropagation();
      buildMenu();
      if (menu) menu.hidden = !menu.hidden;
    });
    document.addEventListener("click", (e) => {
      if (menu && !menu.hidden && e.target !== btn && !menu.contains(e.target)) menu.hidden = true;
    });
  }

  document.querySelectorAll(".share-btn").forEach(wire);
})();
