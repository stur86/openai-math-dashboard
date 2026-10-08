/**
 * After `bun run fetch-catalogue <sha>`, carries data/annotations.json over to the new catalogue.
 *
 * Upstream revisions change a paper's slug (the date suffix moves), so annotations are matched by
 * slug with the date stripped. Papers that disappeared upstream (usually withdrawals) lose their
 * annotation. Prints what needs editorial attention: new papers, changed titles/abstracts, drops.
 *
 * Usage: bun scripts/sync-annotations.ts [old-catalogue.json]
 * The old catalogue defaults to the committed version (`git show HEAD:data/catalogue.json`).
 */
import path from "node:path";
import { $ } from "bun";

type Paper = { slug: string; title: string; abstract: string };
type Catalogue = { source: { ref: string }; papers: Paper[] };

const dataDir = path.join(import.meta.dir, "..", "data");
const annotationsFile = path.join(dataDir, "annotations.json");

const oldCatalogue: Catalogue = process.argv[2]
  ? await Bun.file(process.argv[2]).json()
  : JSON.parse(await $`git show HEAD:data/catalogue.json`.cwd(dataDir).text());
const newCatalogue: Catalogue = await Bun.file(path.join(dataDir, "catalogue.json")).json();
const annotations: Record<string, unknown> = await Bun.file(annotationsFile).json();

const stem = (slug: string) =>
  slug.replace(/-(January|February|March|April|May|June|July|August|September|October|November|December)-\d{1,2}-\d{4}$/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "");

const oldBySlug = new Map(oldCatalogue.papers.map(p => [p.slug, p]));
const newSlugs = new Set(newCatalogue.papers.map(p => p.slug));
const removed = oldCatalogue.papers.filter(p => !newSlugs.has(p.slug));

const renamed: [Paper, Paper][] = [];
const added: Paper[] = [];
const changed: [Paper, Paper][] = [];
const result: Record<string, unknown> = {};

for (const p of newCatalogue.papers) {
  let prev = oldBySlug.get(p.slug);
  if (!prev) {
    const candidates = removed.filter(r => stem(r.slug) === stem(p.slug));
    if (candidates.length === 1) {
      prev = candidates[0]!;
      renamed.push([prev, p]);
    }
  }
  // Prefer an annotation already keyed by the new slug, so re-running is harmless.
  const annotation = annotations[p.slug] ?? (prev && annotations[prev.slug]);
  if (annotation) {
    result[p.slug] = annotation;
  } else {
    added.push(p);
  }
  if (prev && (prev.title !== p.title || prev.abstract !== p.abstract)) changed.push([prev, p]);
}
const carried = new Set(renamed.map(([prev]) => prev.slug));
const dropped = removed.filter(r => !carried.has(r.slug));

await Bun.write(annotationsFile, JSON.stringify(result, null, 2) + "\n");

console.log(`Catalogue ${oldCatalogue.source.ref.slice(0, 8)} -> ${newCatalogue.source.ref.slice(0, 8)}: ` +
  `${oldCatalogue.papers.length} -> ${newCatalogue.papers.length} papers`);
console.log(`\nRenamed (annotation carried over): ${renamed.length}`);
for (const [prev, p] of renamed) console.log(`  ${prev.slug}\n    -> ${p.slug}`);
console.log(`\nDropped upstream (annotation removed; check history.md for withdrawals): ${dropped.length}`);
for (const p of dropped) console.log(`  ${p.slug}`);
console.log(`\nTitle or abstract changed (review the annotation): ${changed.length}`);
for (const [prev, p] of changed) {
  console.log(`\n  ${p.slug}`);
  if (prev.title !== p.title) console.log(`    OLD TITLE: ${prev.title}\n    NEW TITLE: ${p.title}`);
  if (prev.abstract !== p.abstract) console.log(`    OLD: ${prev.abstract}\n    NEW: ${p.abstract}`);
}
console.log(`\nNew papers needing an annotation: ${added.length}`);
for (const p of added) console.log(`  ${p.slug}`);
