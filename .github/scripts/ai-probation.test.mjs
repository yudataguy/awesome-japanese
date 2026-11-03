// Run: node --test .github/scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addRobot,
  addMonths,
  itemsToIntake,
  moveIntoAI,
  moveOutOfAI,
  choicesBlock,
  parseChoice,
  parse,
  probationStatus,
} from "./ai-probation.mjs";

const BASE = `# Awesome

## Vocabulary

- [Anki](https://apps.ankiweb.net/) - Flashcards.
- [Jisho Cards](https://jc.example/) - Cards :moneybag:.

## Video

- [Tube](https://tube.example/) - Videos.

## AI

*Intro.*

- Vocabulary
  - [KaChiKa](https://kachika.app/) - Photo vocab :iphone: :robot:.
- Video
  - [mLearn](https://mlearn.example) - Subtitles :robot:.

## Contributing

See contributing.md.
`;

const section = (md, name) => {
  const { lines, sections } = parse(md);
  const s = sections.get(name);
  return lines.slice(s.start, s.end).join("\n");
};

test("addRobot puts the emoji before the final period", () => {
  assert.equal(addRobot("- [A](u) - Thing :moneybag:."), "- [A](u) - Thing :moneybag: :robot:.");
  assert.equal(addRobot("- [A](u) - Thing :robot:."), "- [A](u) - Thing :robot:.");
});

test("addMonths clamps to month end", () => {
  assert.equal(addMonths("2026-09-23", 6), "2027-03-23");
  assert.equal(addMonths("2026-08-31", 6), "2027-02-28");
});

test("intake picks only new :robot: items outside the AI section", () => {
  const after = BASE.replace(
    "- [Tube](https://tube.example/) - Videos.",
    "- [Tube](https://tube.example/) - Videos :robot:.\n- [NewAI](https://new.example) - AI subs :robot:.\n- [Plain](https://plain.example) - Not AI."
  );
  // Tube gained :robot: but was already listed: not new, so left alone.
  assert.deepEqual(itemsToIntake(BASE, after).map((i) => i.name), ["NewAI"]);
  // Survey says Mostly AI: every new item counts.
  assert.deepEqual(itemsToIntake(BASE, after, { mostlyAi: true }).map((i) => i.name), ["NewAI", "Plain"]);
});

test("moveIntoAI appends to an existing group", () => {
  const md = BASE.replace("- [Tube](https://tube.example/) - Videos.", "- [Tube](https://tube.example/) - Videos.\n- [NewAI](https://new.example) - AI subs :robot:.");
  const out = moveIntoAI(md, "https://new.example");
  assert.ok(!section(out, "Video").includes("NewAI"));
  assert.match(section(out, "AI"), /- Video\n  - \[mLearn\][^\n]*\n  - \[NewAI\]\(https:\/\/new.example\) - AI subs :robot:\./);
});

test("moveIntoAI creates a missing group and adds :robot:", () => {
  const md = BASE.replace("## Video\n", "## Grammar\n\n- [Gram](https://gram.example) - AI grammar.\n\n## Video\n");
  const out = moveIntoAI(md, "https://gram.example");
  assert.ok(!section(out, "Grammar").includes("Gram]"));
  assert.match(section(out, "AI"), /- Video\n  - \[mLearn\][^\n]*\n- Grammar\n  - \[Gram\]\(https:\/\/gram.example\) - AI grammar :robot:\.\n$/);
});

test("moveOutOfAI appends to the end of its section and drops an empty group", () => {
  const out = moveOutOfAI(BASE, "https://kachika.app/");
  assert.ok(section(out, "Vocabulary").endsWith("- [Jisho Cards](https://jc.example/) - Cards :moneybag:.\n- [KaChiKa](https://kachika.app/) - Photo vocab :iphone: :robot:.\n"));
  assert.ok(!section(out, "AI").includes("- Vocabulary"));
  assert.ok(section(out, "AI").includes("- Video\n  - [mLearn]"));
});

test("probationStatus never starts before the AI section existed", () => {
  const seen = { "https://kachika.app/": "2026-06-01", "https://mlearn.example": "2026-10-15" };
  const rows = probationStatus(BASE, "2027-03-23", (u) => seen[u]);
  assert.deepEqual(
    rows.map(({ name, since, due }) => ({ name, since, due })),
    [
      { name: "KaChiKa", since: "2026-09-23", due: true },
      { name: "mLearn", since: "2026-10-15", due: false },
    ]
  );
});

test("round-trips every AI item in the real readme", () => {
  const real = readFileSync(new URL("../../readme.md", import.meta.url), "utf8");
  for (const item of parse(real).items.filter((i) => i.h2 === "AI")) {
    const out = moveOutOfAI(real, item.url);
    assert.equal(parse(out).items.length, parse(real).items.length, item.name);
    assert.ok(section(out, item.group).includes(item.line.trim()), item.name);
  }
});

test("moveIntoAI leaves existing sub-items behind", () => {
  const before = BASE.replace("- [Anki](https://apps.ankiweb.net/) - Flashcards.", "- [Anki](https://apps.ankiweb.net/) - Flashcards.\n  - [Manual](https://docs.example/)");
  const after = before.replace("- [Anki](https://apps.ankiweb.net/) - Flashcards.", "- [Anki](https://apps.ankiweb.net/) - Flashcards.\n- [NewAI](https://new.example) - AI :robot:.");
  const stay = new Set(parse(before).items.map((i) => i.url));
  const out = moveIntoAI(after, "https://new.example", stay);
  assert.ok(section(out, "Vocabulary").includes("  - [Manual](https://docs.example/)"));
  assert.ok(!section(out, "AI").includes("Manual"));
});

test("moveOutOfAI --to goes after the last item, sub-items included", () => {
  const md = BASE.replace("- [Tube](https://tube.example/) - Videos.", "- [Tube](https://tube.example/) - Videos.\n  - Chrome\n    - [Ext](https://ext.example) - Ext.");
  const out = moveOutOfAI(md, "https://kachika.app/", "Video");
  assert.ok(section(out, "Video").endsWith("    - [Ext](https://ext.example) - Ext.\n- [KaChiKa](https://kachika.app/) - Photo vocab :iphone: :robot:.\n"));
  assert.throws(() => moveOutOfAI(md, "https://kachika.app/", "Contributing"), /not a section/);
});

test("choices block round-trips through parseChoice", () => {
  const block = choicesBlock(BASE, "https://kachika.app/", "Vocabulary");
  assert.match(block, /- \[x\] Vocabulary \(intended\)\n- \[ \] Video\n- \[ \] Keep in the AI section/);
  const body = `Intro\n\n${block}\n\nOutro`;
  assert.deepEqual(parseChoice(body), { url: "https://kachika.app/", current: "Vocabulary", ticked: ["Vocabulary"], picked: null, ambiguous: false });
  // Ticking Video in the UI leaves Vocabulary ticked too.
  const ticked = body.replace("- [ ] Video", "- [x] Video");
  assert.equal(parseChoice(ticked).picked, "Video");
  // Or the maintainer unticked the old box first.
  assert.equal(parseChoice(ticked.replace("- [x] Vocabulary", "- [ ] Vocabulary")).picked, "Video");
  const keep = body.replace("- [ ] Keep", "- [x] Keep");
  assert.equal(parseChoice(keep).picked, "Keep in the AI section (closes this PR)");
  assert.equal(parseChoice(ticked.replace("- [ ] Keep", "- [x] Keep")).ambiguous, true);
  assert.equal(parseChoice("no block here"), null);
});
