// Builds the themed homepage (index.html) from readme.md.
// Run: node site/build.mjs  (needs the `marked` dependency)
// The GitHub Action reruns this whenever readme.md or site/* changes.

import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { marked } from "marked";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SITE_URL = "https://yudataguy.github.io/Awesome-Japanese/";

// GitHub emoji shortcodes used in the readme -> real emoji (so the page matches GitHub).
const EMOJI = {
  baby: "👶", man: "🧑", older_man: "🧓", iphone: "📱", computer: "💻",
  satellite: "📡", jp: "🇯🇵", japan: "🗾", moneybag: "💰", warning: "⚠️",
  book: "📖", card_index: "🗂️", tv: "📺", headphones: "🎧", mag: "🔍",
  scroll: "📜", pencil: "✏️", bulb: "💡", star: "⭐", fire: "🔥",
  robot: "🤖",
};

const slug = (s) =>
  s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

function buildContent(md) {
  // The template supplies the hero (title, intro, TV CTA) and the sidebar TOC,
  // so drop the markdown's own H1/intro/Contents and start at the first section.
  const startMarker = "## How To Use These Resources";
  const idx = md.indexOf(startMarker);
  let body = idx >= 0 ? md.slice(idx) : md;

  // Convert :shortcode: emoji. Warn on any shortcode we don't map, so a new
  // legend entry can't silently ship as literal ":name:" text on the page.
  const unmapped = new Set();
  body = body.replace(/:([a-z0-9_+-]+):/g, (m, name) => {
    if (!(name in EMOJI)) {
      unmapped.add(name);
      return m;
    }
    return EMOJI[name];
  });
  if (unmapped.size) {
    console.warn(
      `⚠️  Unmapped emoji shortcode(s) left as literal text: ${[...unmapped]
        .map((n) => `:${n}:`)
        .join(", ")}. Add them to EMOJI in site/build.mjs.`
    );
  }

  let html = marked.parse(body, { gfm: true });

  // Add slug ids to h2/h3 and collect h2s for the table of contents.
  const toc = [];
  html = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (m, level, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    const id = slug(text);
    if (level === "2") toc.push({ id, text });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });

  const tocHtml =
    "<ul>" + toc.map((t) => `<li><a href="#${t.id}">${t.text}</a></li>`).join("") + "</ul>";

  return { html, tocHtml };
}

function sitemap() {
  const urls = [SITE_URL];
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") +
    "\n</urlset>\n"
  );
}

const readme = await readFile(join(ROOT, "readme.md"), "utf8");
const template = await readFile(join(__dirname, "template.html"), "utf8");

const { html, tocHtml } = buildContent(readme);
const page = template.replace("{{TOC}}", tocHtml).replace("{{CONTENT}}", html);

await mkdir(join(ROOT, "assets"), { recursive: true });
await copyFile(join(__dirname, "home.css"), join(ROOT, "assets", "home.css"));
await copyFile(join(__dirname, "share.js"), join(ROOT, "assets", "share.js"));
await copyFile(join(__dirname, "social-preview.png"), join(ROOT, "assets", "social-preview.png"));
await writeFile(join(ROOT, "index.html"), page);
await writeFile(join(ROOT, "sitemap.xml"), sitemap());

console.log("Built index.html, assets/home.css, sitemap.xml");
