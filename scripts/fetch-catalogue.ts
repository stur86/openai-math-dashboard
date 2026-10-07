/**
 * Fetches the openai/math catalogue (CONTENTS.md, overview.tex, formalization.yaml)
 * at a pinned commit and writes the factual paper metadata to data/catalogue.json.
 *
 * Usage: bun scripts/fetch-catalogue.ts [commit-sha]
 */
import path from "node:path";

const REPO = "openai/math";
const ref = process.argv[2] ?? "adc7f1241b42e322a6451854ab7e4b4c146bf78a";
const raw = (file: string) => `https://raw.githubusercontent.com/${REPO}/${ref}/${file}`;

async function get(file: string): Promise<string> {
  const res = await fetch(raw(file));
  if (!res.ok) throw new Error(`Failed to fetch ${file}: ${res.status}`);
  return res.text();
}

const [contents, overview, formalization] = await Promise.all([
  get("CONTENTS.md"),
  get("overview.tex"),
  get("lean/formalization.yaml"),
]);

// Discipline of each family, from \cataloguesection{Name}{n} followed by \resultentry{NNN}...
const disciplineByFamily = new Map<string, string>();
let section = "Uncategorized";
for (const line of overview.split("\n")) {
  const sec = line.match(/^\\cataloguesection\{([^}]+)\}/);
  if (sec) section = sec[1]!;
  const entry = line.match(/^\\resultentry\{(\d+)\}/);
  if (entry) disciplineByFamily.set(entry[1]!, section);
}

// Papers with a Lean formalization. Each family with formal proofs has a scope document,
// lean/docs/NNN.md, listing the papers it covers; formalization.yaml lists a subset of them.
const leanDocIds = [...new Set([...contents.matchAll(/\(lean\/docs\/(\d+)\.md\)/g)].map(m => m[1]!))];
const leanDocs = await Promise.all(leanDocIds.map(async id => [id, await get(`lean/docs/${id}.md`)] as const));
const formalized = new Map<string, string>(); // paper slug -> Lean scope document URL
for (const [id, doc] of leanDocs) {
  const url = `https://github.com/${REPO}/blob/main/lean/docs/${id}.md`;
  for (const m of doc.matchAll(/\.\.\/\.\.\/preprints\/([^/]+)\//g)) formalized.set(m[1]!, url);
}
for (const m of formalization.matchAll(/id: \.\.\/preprints\/([^/]+)\//g)) {
  if (!formalized.has(m[1]!)) formalized.set(m[1]!, `https://github.com/${REPO}/blob/main/lean/formalization.yaml`);
}

/** Convert the light HTML/markdown in CONTENTS.md to plain text with inline $math$. */
function clean(text: string): string {
  return text
    .replace(/\$`([^`]*)`\$/g, (_, m) => `$${m}$`)
    .replace(/<sub>(.*?)<\/sub>/g, "_{$1}")
    .replace(/<sup>(.*?)<\/sup>/g, "^{$1}")
    .replace(/<\/?i>/g, "")
    .replace(/<\/?b>/g, "")
    .replace(/&emsp;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type Family = { id: string; title: string; description: string; discipline: string };
type Paper = {
  slug: string;
  title: string;
  date: string;
  family: string;
  abstract: string;
  pdfUrl: string;
  dirUrl: string;
  formalized: boolean;
  leanUrl: string | null;
};

const families: Family[] = [];
const papers: Paper[] = [];
const cells = [...contents.matchAll(/<td>\s*([\s\S]*?)\s*<\/td>/g)].map(m => m[1]!);

let current: Family | undefined;
for (const cell of cells) {
  const fam = cell.match(/^\*\*(\d+)\. ([\s\S]*?)\*\* ([\s\S]*)$/);
  if (fam) {
    const [, id, title, description] = fam as unknown as [string, string, string, string];
    current = {
      id,
      title: clean(title).replace(/\.$/, ""),
      description: clean(description),
      discipline: disciplineByFamily.get(id) ?? "Uncategorized",
    };
    families.push(current);
    continue;
  }
  const paper = cell.match(/^&emsp;\[([\s\S]*?)\]\((preprints\/([^/]+)\/[^)]+)\)\s*([\s\S]*)$/);
  if (paper && current) {
    const [, title, pdfPath, slug, abstract] = paper as unknown as [string, string, string, string, string];
    const dateMatch = slug.match(/-([A-Z][a-z]+)-(\d{1,2})-(\d{4})$/);
    const isoMatch = slug.match(/-(\d{4}-\d{2}-\d{2})$/);
    const date = dateMatch
      ? new Date(`${dateMatch[1]} ${dateMatch[2]}, ${dateMatch[3]} UTC`).toISOString().slice(0, 10)
      : (isoMatch?.[1] ?? "");
    papers.push({
      slug,
      title: clean(title),
      date,
      family: current.id,
      abstract: clean(abstract),
      pdfUrl: `https://github.com/${REPO}/blob/main/${pdfPath}`,
      dirUrl: `https://github.com/${REPO}/tree/main/preprints/${slug}`,
      formalized: formalized.has(slug),
      leanUrl: formalized.get(slug) ?? null,
    });
  }
}

const out = path.join(import.meta.dir, "..", "data", "catalogue.json");
await Bun.write(
  out,
  JSON.stringify({ source: { repo: REPO, ref, fetchedAt: new Date().toISOString() }, families, papers }, null, 2) + "\n",
);
const unknown = [...formalized.keys()].filter(s => !papers.some(p => p.slug === s));
if (unknown.length) console.warn("Lean docs reference papers missing from CONTENTS.md:", unknown);
console.log(`Wrote ${families.length} families, ${papers.length} papers (${papers.filter(p => p.formalized).length} formalized) to ${out}`);
