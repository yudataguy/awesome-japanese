// Generative AI probation helpers (see "Generative AI Probation" in
// contributing.md). Used by two workflows:
//
//   ai-probation-intake.yml  -- after a merge, moves new :robot: items that
//                               landed outside the AI section into it.
//   ai-probation-review.yml  -- on a schedule, finds AI items whose probation
//                               is over and opens a PR moving each one out.
//   ai-probation-choose.yml  -- when a maintainer ticks a different section
//                               in that PR, rebuilds it to move there instead.
//
// No dependencies; pure functions are exported for ai-probation.test.mjs.
//
// CLI (run from the repo root):
//   node .github/scripts/ai-probation.mjs intake <before-sha> <after-sha> [--mostly-ai]
//   node .github/scripts/ai-probation.mjs due [--today YYYY-MM-DD]
//   node .github/scripts/ai-probation.mjs graduate <url> [--to <section>]
//       (rewrites readme.md; prints the PR body's multiple-choice block)
//   node .github/scripts/ai-probation.mjs parse-choice < pr-body.md

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const README = "readme.md";
export const AI_SECTION = "AI";
// Items already on the list when the AI section was created began probation
// on this day (contributing.md), whatever their original merge date.
export const AI_SECTION_START = "2026-09-23";
export const PROBATION_MONTHS = 6;
// h2 sections that aren't list categories, so can't be a group.
const NOT_CATEGORIES = new Set([
  AI_SECTION,
  "Contents",
  "How To Use These Resources",
  "Contributing",
  "Featured on This List",
]);

const ITEM_RE = /^(\s*)[-*]\s+\[([^\]]+)\]\(([^)\s]+)[^)]*\)/;
export const normUrl = (u) => u.trim().toLowerCase().replace(/\/+$/, "");
const indentOf = (line) => line.match(/^\s*/)[0].length;

// Describe every linked list item and every h2 section of the readme.
export function parse(md) {
  const lines = md.split("\n");
  const items = [];
  const sections = new Map(); // h2 -> { start (heading idx), end (exclusive) }
  let h2 = null;
  let group = null; // "- Section" line inside the AI section
  lines.forEach((raw, idx) => {
    const line = raw.replace(/\s+$/, "");
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      if (h2 !== null) sections.get(h2).end = idx;
      h2 = heading[1].trim();
      group = null;
      sections.set(h2, { start: idx, end: lines.length });
      return;
    }
    const item = line.match(ITEM_RE);
    if (item) {
      items.push({
        idx,
        line,
        name: item[2],
        rawUrl: item[3],
        url: normUrl(item[3]),
        h2,
        indent: item[1].length,
        group: h2 === AI_SECTION ? group : null,
        robot: line.includes(":robot:"),
      });
      return;
    }
    const groupLine = line.match(/^[-*]\s+(.+)$/);
    if (groupLine && h2 === AI_SECTION) group = groupLine[1].trim();
  });
  const categories = [...sections.keys()].filter((s) => !NOT_CATEGORIES.has(s));
  return { lines, items, sections, categories };
}

// House style puts emoji before the final period: "... :moneybag: :robot:."
export function addRobot(line) {
  if (line.includes(":robot:")) return line;
  return /\.\s*$/.test(line) ? line.replace(/\.\s*$/, " :robot:.") : `${line} :robot:`;
}

// The item's line plus any more-indented lines nested under it. Stops at a
// nested item whose link is in `stayUrls`: a new item wedged above existing
// sub-items mustn't carry them off.
function blockEnd(lines, idx, stayUrls = new Set()) {
  const base = indentOf(lines[idx]);
  let end = idx + 1;
  while (end < lines.length && lines[end].trim() !== "" && indentOf(lines[end]) > base) {
    const nested = lines[end].match(ITEM_RE);
    if (nested && stayUrls.has(normUrl(nested[3]))) break;
    end++;
  }
  return end;
}

function reindent(block, newIndent) {
  const shift = newIndent - indentOf(block[0]);
  return block.map((l) => (shift >= 0 ? " ".repeat(shift) + l : l.slice(Math.min(-shift, indentOf(l)))));
}

// Last non-blank line of a section, plus one: where a new list line goes.
function sectionTail(lines, { start, end }) {
  let i = end;
  while (i > start + 1 && lines[i - 1].trim() === "") i--;
  return i;
}

// Items added by a merge that should be in the AI section but aren't: new
// links (not anywhere in `before`) outside the AI section that carry :robot:,
// or, when the merged PR's survey said "Mostly AI (>50%)", any new link.
export function itemsToIntake(beforeMd, afterMd, { mostlyAi = false } = {}) {
  const beforeUrls = new Set(parse(beforeMd).items.map((i) => i.url));
  return parse(afterMd).items.filter(
    (i) =>
      !beforeUrls.has(i.url) &&
      i.h2 !== AI_SECTION &&
      !NOT_CATEGORIES.has(i.h2) &&
      i.indent === 0 &&
      (i.robot || mostlyAi)
  );
}

// Move one item (by url) from its section into the AI section, under a group
// line named after that section. Adds :robot: if missing. `stayUrls`: links
// already on the list before the merge (see blockEnd).
export function moveIntoAI(md, url, stayUrls) {
  const { lines, items, sections } = parse(md);
  const item = items.find((i) => i.url === normUrl(url) && i.h2 !== AI_SECTION);
  if (!item) throw new Error(`No item outside the AI section with url ${url}`);
  if (!sections.has(AI_SECTION)) throw new Error("readme has no AI section");

  const end = blockEnd(lines, item.idx, stayUrls);
  const block = reindent(lines.slice(item.idx, end), 2);
  block[0] = addRobot(block[0]);
  lines.splice(item.idx, end - item.idx);

  // Re-parse: indices after the removed block shifted.
  const after = parse(lines.join("\n"));
  const ai = after.sections.get(AI_SECTION);
  const groupIdx = after.lines.findIndex(
    (l, i) => i > ai.start && i < ai.end && l.replace(/\s+$/, "") === `- ${item.h2}`
  );
  if (groupIdx !== -1) {
    // Append after the group's last nested line.
    after.lines.splice(blockEnd(after.lines, groupIdx), 0, ...block);
  } else {
    after.lines.splice(sectionTail(after.lines, ai), 0, `- ${item.h2}`, ...block);
  }
  return after.lines.join("\n");
}

// Where a graduating item's line goes inside its target section.
//   lines    -- the whole readme as an array of lines
//   section  -- { start, end } of the target h2: `start` is the "## Name"
//               heading line, `end` is the next h2's line (exclusive)
// Return the line index to insert at; the item is inserted as a top-level
// "- [Name](url) ..." line. Graduated items go after the section's last list
// line (including the last item's nested sub-items), so they read as the
// newest entry of the section.
export function insertionIndex(lines, section) {
  for (let i = section.end - 1; i > section.start; i--) {
    if (/^\s*[-*]\s/.test(lines[i])) return i + 1;
  }
  return section.start + 2; // empty section: after the heading and a blank
}

// Move one item (by url) out of the AI section into section `to` (default:
// the section its group names). Drops the group line if it's left empty.
export function moveOutOfAI(md, url, to = null) {
  const { lines, items, sections, categories } = parse(md);
  const item = items.find((i) => i.url === normUrl(url) && i.h2 === AI_SECTION);
  if (!item) throw new Error(`No item in the AI section with url ${url}`);
  const target = to ?? item.group;
  if (!target || !categories.includes(target)) {
    throw new Error(`Can't move ${item.name} to "${target ?? "(no group)"}": not a section of the readme`);
  }

  const end = blockEnd(lines, item.idx);
  const block = reindent(lines.slice(item.idx, end), 0);
  lines.splice(item.idx, end - item.idx);

  // Drop the group line if no items remain under it.
  const groupIdx = lines.findIndex((l, i) => i < item.idx && l.replace(/\s+$/, "") === `- ${item.group}` && i > sections.get(AI_SECTION).start);
  if (groupIdx !== -1 && blockEnd(lines, groupIdx) === groupIdx + 1) lines.splice(groupIdx, 1);

  const after = parse(lines.join("\n"));
  after.lines.splice(insertionIndex(after.lines, after.sections.get(target)), 0, ...block);
  return after.lines.join("\n");
}

// The multiple-choice block in a graduation PR body. The maintainer ticks one
// box; ai-probation-choose.yml reads it back with parseChoice().
export const KEEP_CHOICE = "Keep in the AI section (closes this PR)";
const INTENDED = " (intended)";

export function choicesBlock(md, url, selected) {
  const { categories } = parse(md);
  const item = parse(md).items.find((i) => i.url === normUrl(url) && i.h2 === AI_SECTION);
  const options = categories.map((c) => `- [${c === selected ? "x" : " "}] ${c}${c === item?.group ? INTENDED : ""}`);
  return [
    `<!-- ai-graduate url=${url} to=${selected} -->`,
    "<!-- choices -->",
    ...options,
    `- [ ] ${KEEP_CHOICE}`,
    "<!-- /choices -->",
  ].join("\n");
}

// Read a graduation PR body: the item url, the section the branch currently
// moves it to, and which boxes are ticked.
export function parseChoice(body) {
  const marker = body.match(/<!-- ai-graduate url=(\S+) to=(.+?) -->/);
  const block = body.match(/<!-- choices -->([\s\S]*?)<!-- \/choices -->/);
  if (!marker || !block) return null;
  const ticked = [...block[1].matchAll(/^\s*[-*] \[[xX]\] (.+?)\s*$/gm)].map((m) =>
    m[1].endsWith(INTENDED) ? m[1].slice(0, -INTENDED.length) : m[1]
  );
  // Clicking a box in GitHub's UI leaves the previous one ticked too, so the
  // pick is whatever is ticked besides the current choice.
  const others = ticked.filter((t) => t !== marker[2]);
  const picked = others.length === 1 ? others[0] : null;
  return { url: marker[1], current: marker[2], ticked, picked, ambiguous: others.length > 1 };
}

export function addMonths(isoDate, months) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() !== day) d.setUTCDate(0); // Aug 31 + 6mo -> Feb 28, not Mar 3
  return d.toISOString().slice(0, 10);
}

// Probation start for each AI item: when its link first reached main (the
// merge, thanks to --first-parent), but never before the AI section existed.
// `firstSeen(rawUrl)` returns "YYYY-MM-DD" or null; injectable for tests.
export function probationStatus(md, today, firstSeen) {
  return parse(md)
    .items.filter((i) => i.h2 === AI_SECTION && i.indent > 0)
    .map((i) => {
      const seen = firstSeen(i.rawUrl) ?? today;
      const since = seen < AI_SECTION_START ? AI_SECTION_START : seen;
      const dueOn = addMonths(since, PROBATION_MONTHS);
      return { name: i.name, url: i.rawUrl, group: i.group, since, dueOn, due: dueOn <= today };
    });
}

function gitFirstSeen(rawUrl) {
  const out = execFileSync(
    "git",
    ["log", "--first-parent", "--reverse", "--format=%cs", "-S", rawUrl, "--", README],
    { encoding: "utf8" }
  ).trim();
  return out ? out.split("\n")[0] : null;
}

const gitShow = (sha) => {
  try {
    return execFileSync("git", ["show", `${sha}:${README}`], { encoding: "utf8" });
  } catch {
    return ""; // readme absent at that commit
  }
};

function main(argv) {
  const [cmd, ...args] = argv;
  if (cmd === "intake") {
    const [beforeSha, afterSha] = args;
    const mostlyAi = args.includes("--mostly-ai");
    const before = gitShow(beforeSha);
    let md = readFileSync(README, "utf8");
    const moved = itemsToIntake(before, gitShow(afterSha), { mostlyAi });
    const stayUrls = new Set(parse(before).items.map((i) => i.url));
    for (const item of moved) md = moveIntoAI(md, item.url, stayUrls);
    if (moved.length) writeFileSync(README, md);
    console.log(JSON.stringify(moved.map(({ name, rawUrl, h2, robot }) => ({ name, url: rawUrl, section: h2, hadRobot: robot }))));
  } else if (cmd === "due") {
    const i = args.indexOf("--today");
    const today = i !== -1 ? args[i + 1] : new Date().toISOString().slice(0, 10);
    console.log(JSON.stringify(probationStatus(readFileSync(README, "utf8"), today, gitFirstSeen)));
  } else if (cmd === "graduate") {
    const i = args.indexOf("--to");
    const md = readFileSync(README, "utf8");
    // Print the choices block first: it needs the item still in the AI section.
    const to = i !== -1 ? args[i + 1] : parse(md).items.find((it) => it.url === normUrl(args[0]) && it.h2 === AI_SECTION)?.group;
    console.log(choicesBlock(md, args[0], to));
    writeFileSync(README, moveOutOfAI(md, args[0], to));
  } else if (cmd === "parse-choice") {
    console.log(JSON.stringify(parseChoice(readFileSync(0, "utf8"))));
  } else {
    console.error("usage: ai-probation.mjs intake <before> <after> [--mostly-ai] | due [--today D] | graduate <url> [--to <section>] | parse-choice < body");
    process.exit(2);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
