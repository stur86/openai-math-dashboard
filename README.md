# OpenAI math preprints, read and ranked

A static dashboard listing every paper in the [openai/math preprint collection](https://github.com/openai/math/tree/main/preprints), with a plain-language summary, an importance score (1–5), the kind of result and topic tags for each.

The papers were produced by an internal OpenAI model and many are not independently verified. The summaries, scores and tags in this repository are AI-written editorial judgments about what each paper claims, not peer review.

## Data

Data and presentation are kept separate. Both JSON files are baked into the bundle at build time.

- `data/catalogue.json`: facts scraped from the source repository at a pinned commit (titles, abstracts, dates, result families, disciplines, and Lean formalization status read from `lean/docs/*.md` and `lean/formalization.yaml`). Regenerate with `bun run fetch-catalogue [commit-sha]`.
- `data/annotations.json`: editorial layer keyed by paper slug: `summary`, `importance`, `kind` and `tags`.

`src/data.ts` joins the two. `bun test` checks that every paper has exactly one well-formed annotation, so a catalogue refresh that adds papers will fail until they are annotated.

### Importance scale

| Score | Meaning |
|---|---|
| 5 | Landmark: settles a famous, long-open problem |
| 4 | Major: resolves a well-known conjecture in its field |
| 3 | Significant: notable new result |
| 2 | Supporting: special case, companion or technical step |
| 1 | Minor: conditional or narrow |

Scores describe the claimed result, assuming it is correct.

## Development

```bash
bun install
bun dev        # dev server with hot reload
bun test       # data consistency checks
bun run build  # static site in dist/
```

## Deployment

`.github/workflows/pages.yml` type-checks, tests, builds and publishes `dist/` to GitHub Pages on every push to `main`. In the repository settings, set Pages → Source to "GitHub Actions".
