# Contribution Guidelines

Please note that this project is released with a [Contributor Code of Conduct](code-of-conduct.md). By participating in this project you agree to abide by its terms.

Thank you for your interest in contributing to the Awesome Japanese List! We're excited to collaborate with you. This list thrives on the valuable contributions from contributors like you. Here’s how you can help make the Awesome List even more awesome.

## How to Contribute

### Suggesting New Resources

**This list is issue first. Open an issue and wait for it to be approved before you open a pull request.** A pull request that adds or changes a list item without a linked, approved issue is closed automatically.

1. **Check for duplicates**: Before suggesting a resource, please ensure it is not already listed or suggested. Search the [readme](readme.md) and the [open issues](https://github.com/yudataguy/awesome-japanese/issues).
2. **Open a suggestion issue**: Use the [*Suggest a resource*](https://github.com/yudataguy/awesome-japanese/issues/new/choose) issue form. It asks for the name, link, proposed description, category, and why the resource is a valuable addition.
3. **Wait for approval**: A maintainer reviews the suggestion and, if it's accepted, applies the `approved` label to your issue. That label is the go-ahead. Approval first means you never spend time on a pull request for something that turns out to be a duplicate, out of scope, or ineligible.
4. **Open a pull request**: Once your issue carries the `approved` label, submit a pull request and write `Closes #<issue number>` in the description so the two are linked.

#### Why pull requests get closed automatically

An automated check runs on every pull request that touches the [readme](readme.md). It closes the pull request, with an explanation, if:

- the description doesn't reference an issue with a closing keyword (`Closes #123`, `Fixes #123`, `Resolves #123`), or
- the referenced issue doesn't exist, is a pull request rather than an issue, or
- the referenced issue hasn't been given the `approved` label yet.

Being closed isn't a rejection of your resource — it just means the steps happened out of order. Open the issue, get it approved, then add `Closes #<number>` to the pull request description and reopen it. The check runs again on its own.

Changes that don't touch the list itself — fixing a typo in the docs, improving a workflow — don't need an approved issue, though an issue is still welcome for anything worth discussing first.

### Nominating Your Own App or Resource

Self-nominations are welcome — if you built an app, site, or resource that fits the list, you're encouraged to submit it. We only ask that you're up front about it: in your pull request, tick **"I'm affiliated with this item"** under *Your Role* so we can note the affiliation for transparency. Submissions are judged on the same quality bar as any other, regardless of who submits them.

#### Eligibility for Self-Nominated Items

Awesome Japanese is a curated list of genuinely useful Japanese-language content and tools. It is **not** a place for marketing or self-promotion, and a listing is not a launch announcement. To keep self-nominations to resources with a proven track record, an item you nominate yourself must meet **both** of the following:

1. **At least 6 months old.** The item must have been publicly available for at least six months before the pull request is opened. Betas and soft launches count from the date the public could actually use it.
2. **At least 100 users, if it's paid.** If the item has paid plans, in-app purchases, or freemium tiers (i.e. it carries the `:moneybag:` emoji), it must have at least 100 users (registered accounts, active subscribers, or paying customers — any honest measure is fine).

**Proof is required.** Tick the boxes under *Self-Nomination Eligibility* in the pull request template and attach evidence. Either kind is accepted:

- **Public records** — for example a dated launch post, changelog, blog announcement, App Store or Google Play listing showing the release date, Wayback Machine snapshot, public download or review counts, or a press mention.
- **Private records** — for example a screenshot of your analytics, store console, or billing dashboard. Don't post private records on the public pull request; instead say in the PR that you'll provide proof privately, and a maintainer will reach out to arrange it. Private records are used only to verify eligibility and are never published.

Self-nominated pull requests that don't meet these requirements, or that lack proof, will be closed. You're welcome to resubmit once the item qualifies. These requirements apply only to self-nominations — a resource nominated by an unaffiliated third party is not subject to them.

### Generative AI Probation

New generative AI tools appear faster than any other kind of resource on this list, and many of them change quickly or disappear. So every new item that carries the `:robot:` emoji (see *Generative AI* under [Entry Format](#entry-format)) is listed in the **AI** section at the bottom of the [readme](readme.md) first, not straight in the section it belongs to. Probation gives it time to prove it's stable and useful before it sits beside long-established resources.

1. **Add it under its intended section.** Inside the AI section, items are grouped by the section they're meant for. Put yours under the matching group, for example `- Vocabulary`, and add the group if it doesn't exist yet. In your suggestion issue, the category is still the intended section. This is checked automatically: a pull request that adds a new `:robot:` item anywhere else, or puts one in the AI section without a valid group, fails the *PR AI section check*.
2. **Probation lasts 3 to 6 months**, counted from the day the pull request that adds the item is merged. Items that were already on the list when the AI section was created began probation on 2026-09-23, the day they moved into it.
3. **Moving out takes a new request.** Nothing moves automatically. Once an item has been in the AI section for at least 3 months, open a [*Move an item out of the AI section*](https://github.com/yudataguy/awesome-japanese/issues/new/choose) issue, wait for the `approved` label, then open a pull request that moves the line to its intended section and says `Closes #<issue number>`. Maintainers may keep an item in probation for longer, up to 6 months in total, if they need more time to evaluate it (for example after reports of broken features, poor AI output, or a pricing change).
4. **The `:robot:` emoji stays** after the move. It's a transparency tag, not a probation marker.

### Improving Existing Resources

- If you notice a resource that could be improved or updated, please open an issue detailing your proposed changes and wait for it to be approved before opening a pull request.

### Documentation and Miscellaneous

- Suggestions for improving the documentation or any other non-code aspects of the project are welcome. Please open an issue to discuss your ideas.

## Submitting a Pull Request

Before you start: if this pull request adds or changes a list item, make sure your suggestion issue already carries the `approved` label (see *Suggesting New Resources* above). Without it the pull request will be closed automatically.

1. Fork the repository.
2. Create a new branch for your contribution (`git checkout -b new-resource`).
3. Add your resource or make your changes in the relevant section. Items that carry the `:robot:` emoji go in the AI section, under their intended section (see *Generative AI Probation* above).
4. Commit your changes with a clear and descriptive message (`git commit -m "Added [Resource Name]"`).
5. Push the branch to your fork (`git push origin new-resource`).
6. Open a pull request from your fork to the original repository.

## Entry Format

Add each item as a single list line in the form:

```markdown
- [Name](https://example.com) - Short description ending with a period.
```

- Use the linked **Name** for the resource, followed by ` - ` and a description.
- Capitalize the description and end it with a period.
- Prefer `https://` links, and confirm the link works before submitting.
- **Pricing:** don't use the word "free" in a description — items without the `:moneybag:` emoji are already treated as free, so it's redundant. If the item has freemium tiers, in-app purchases, or paid plans, add `:moneybag:` instead. See the emoji legend at the top of the [readme](readme.md).
- **Pricing changes after merge:** if an item starts charging money later (paid plans, in-app purchases, or freemium tiers), please open a pull request to revise its description and add the `:moneybag:` emoji. Entries that begin charging without being updated may be removed without warning.
- **Generative AI:** add the `:robot:` emoji if either applies — the item **uses** generative AI in the product itself (e.g. an AI tutor, AI-graded practice, or AI-generated example sentences), *or* the item was **mostly built with** generative AI, meaning AI did most of the work (the *"Mostly AI (>50%)"* answer in the pull request's AI Assistance survey). Light AI assistance during development is now common and does **not** qualify on its own — the bar is >50%. This is a neutral tag for transparency, not a judgment of quality. See the emoji legend at the top of the [readme](readme.md). New `:robot:` items start in the AI section (see *Generative AI Probation* above).

## Guidelines

- Open an issue first and wait for the `approved` label before submitting a pull request that adds or changes a list item.
- Ensure your contribution is in line with the project's theme and quality standards.
- Keep the **description to one concise sentence, under 100 characters** — count only the visible description text (the name, link URLs, and any emoji don't count toward the limit). This is checked automatically when you open a pull request, so an over-length description will fail the Markdown lint check.
- Provide a clear and concise description for each contribution.
- Check your spelling and grammar.
- Please disclose any affiliation if you own or are connected to the resource, so we can note it for transparency (see *Nominating Your Own App or Resource* above).
- Self-nominated items must be at least 6 months old and, if paid, have at least 100 users, with proof (see *Eligibility for Self-Nominated Items* above).
- New generative AI (`:robot:`) items go in the AI section for a 3 to 6 month probation. Moving one to its intended section afterwards takes a separate, approved issue and pull request (see *Generative AI Probation* above).
- Read **Editorial Independence** below before submitting an item you're connected to.

## Editorial Independence

Inclusion on this list is editorial. Items are chosen on merit alone, and being listed is never conditional on anything given in return:

- **No link exchange.** You don't need to link back to this list, and offering to won't help your submission.
- **No paid placement.** Listings are not for sale. Nobody has paid to appear here.
- **No affiliate or referral links.** Don't add tracking or referral parameters to a resource you're submitting.

Please don't offer, request, or arrange a reciprocal link, payment, or other consideration in exchange for a listing. Pull requests that do will be closed.

### The "Featured on Awesome Japanese" Badge

If your resource is already listed, you're welcome to display this badge on your own site or README:

[![Featured on Awesome Japanese](https://awesome-japanese.japantv.app/assets/badge.svg)](https://awesome-japanese.japantv.app/?utm_source=badge)

Copy-paste Markdown and HTML snippets are in the [readme](readme.md#featured-on-this-list). The badge is entirely optional. Displaying it earns no preferential treatment, and taking it down will never get an item removed.

## Questions?

If you have any questions or need further clarification on how to contribute, please don't hesitate to open an issue or contact the maintainers directly.

Thank you for your contributions, and let's make this Awesome List even better together!
