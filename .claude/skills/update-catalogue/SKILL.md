---
name: update-catalogue
description: Refresh the dashboard from the latest openai/math commit. Re-pins the catalogue, carries annotations over revised papers, drops withdrawn ones, annotates new papers, and reviews changed ones. Use when the user asks to update, refresh or sync the papers/data with upstream.
---

# Update the catalogue from openai/math

The site joins two files. `data/catalogue.json` holds facts scraped from openai/math at a pinned commit. `data/annotations.json` holds our editorial layer: summary, importance, kind and tags, keyed by paper slug. An update re-pins the catalogue, then repairs the annotations.

## 1. See what changed upstream

```bash
bun -e 'console.log((await Bun.file("data/catalogue.json").json()).source.ref)'   # current pin
gh api repos/openai/math/commits/main --jq '.sha + " " + .commit.committer.date'   # upstream head
```

If the two shas match, stop: there is nothing to do.

Otherwise read upstream's changelog. `history.md` lists withdrawals, proof fixes and new formalizations, newest first:

```bash
curl -sL https://raw.githubusercontent.com/openai/math/<new-sha>/history.md
gh api repos/openai/math/compare/<old-sha>...<new-sha> --jq '.commits[].commit.message'
```

## 2. Re-pin and sync

```bash
bun run fetch-catalogue <new-sha>
bun run sync-annotations
```

Also update the default sha in `scripts/fetch-catalogue.ts` to `<new-sha>`.

`sync-annotations.ts` compares against the committed catalogue. Revised papers get a new date in their slug, so it carries their annotations over. It deletes annotations of papers that vanished upstream, which is how withdrawals show up. Then it prints four lists, each needing the follow-up below:

- **Renamed:** nothing to do unless the paper also appears under "changed".
- **Dropped:** match each one against the withdrawals in `history.md`. Then grep `data/annotations.json` for remaining summaries that mention the dropped result (e.g. "an intermediate step towards …") and reword them.
- **Title or abstract changed:** reread the new abstract. Fix the summary, kind or score if the claim got stronger, weaker or more conditional.
- **New papers:** write annotations (see below). `bun test` fails until every paper has one.

## 3. Writing annotations

Each entry in `data/annotations.json` (keep catalogue order) looks like:

```json
"<slug>": { "summary": "...", "importance": 1-5, "kind": "proof", "tags": ["kebab-case", ...] }
```

- **summary:** one to three sentences in plain language for a reader who is not a specialist.
  - Write `$...$` for inline maths; KaTeX renders it.
  - Avoid `|` characters.
- **kind:** one of `proof`, `counterexample`, `bound`, `algorithm`, `construction`, `partial`.
- **tags:** two to four kebab-case tags.
  - Reuse existing tags where possible: `bun -e 'import {tagCounts} from "./src/data"; console.log(tagCounts)'`.
  - If a new tag's display name comes out wrong, add it to `tagOverrides` in `src/data.ts`.
- **importance:** use the scale in README.md (5 Landmark … 1 Minor). It scores the claim, assuming it is correct. These are subjective editorial calls, and the site says so.

### Accuracy rules

Abstracts often state results in their strongest form. Earlier versions of this dashboard overclaimed because of that, so follow these rules:

- **Read before scoring.** Before giving a 4 or 5, or mentioning a famous problem, read the paper's introduction and main theorem, not just the abstract. The PDF link is `pdfUrl`; fetch it from `raw.githubusercontent.com/openai/math/<sha>/preprints/...`. Check the exact hypotheses, and which parts the paper says are new versus inherited from earlier work or companion preprints.
- **Name famous problems, and state scope.** When a paper touches a well-known problem (a Millennium Prize problem, a Hilbert problem, a named conjecture), say so, because readers may not know. If the paper proves only a case of it, say explicitly that it is a special case and not the full answer, and name the restriction (e.g. "rank 0 or 1 only", "for abelian varieties with complex multiplication, not in general").
- **Use the right verbs.** Use "proves X" only when the full statement of X is proved. Otherwise write "proves X for …" or "settles a special case of X".
- **Watch dependencies.** If a paper depends on a withdrawn paper, or is conditional, reflect that in the summary and score it lower (`partial`, or importance 1–2 for conditional results).

## 4. Check, build, publish

```bash
bun test && bunx tsc --noEmit && bun run build
```

Optionally spot-check with `bun dev` (http://localhost:3000).

Commit the catalogue, annotations and script changes together. The message should name the new upstream sha and summarise withdrawals, revisions and new papers. Pushing to `main` deploys the live site through `.github/workflows/pages.yml`. Push only when the user has asked to publish, then confirm the run with `gh run watch`.

Report back to the user:
- old → new paper counts
- withdrawals
- annotations that changed in substance
- new papers with importance 4 or higher
