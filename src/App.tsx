import { useEffect, useMemo, useState } from "react";
import {
  disciplines,
  importanceLabels,
  kindLabels,
  papers,
  source,
  tagCounts,
  tagName,
  type Kind,
  type Paper,
} from "./data";
import { MathText } from "./Math";
import "./index.css";

type Sort = "importance" | "newest" | "family" | "title";

type Filters = {
  q: string;
  discipline: string | null;
  minImportance: number;
  kinds: Kind[];
  tag: string | null;
  family: string | null;
  formalizedOnly: boolean;
  sort: Sort;
};

const PAGE = 60;
const TOP_TAGS = tagCounts.filter(t => t.count >= 6).slice(0, 40);
const TOPICS_COLLAPSED = 12;
const kinds = Object.keys(kindLabels) as Kind[];

const defaults: Filters = {
  q: "",
  discipline: null,
  minImportance: 1,
  kinds: [],
  tag: null,
  family: null,
  formalizedOnly: false,
  sort: "importance",
};

function readUrl(): Filters {
  const p = new URLSearchParams(location.search);
  const sort = p.get("sort");
  return {
    q: p.get("q") ?? "",
    discipline: p.get("area"),
    minImportance: Number(p.get("min") ?? 1) || 1,
    kinds: (p.get("kind")?.split(",").filter(k => k in kindLabels) ?? []) as Kind[],
    tag: p.get("tag"),
    family: p.get("family"),
    formalizedOnly: p.get("lean") === "1",
    sort: sort === "newest" || sort === "family" || sort === "title" ? sort : "importance",
  };
}

function writeUrl(f: Filters) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.discipline) p.set("area", f.discipline);
  if (f.minImportance > 1) p.set("min", String(f.minImportance));
  if (f.kinds.length) p.set("kind", f.kinds.join(","));
  if (f.tag) p.set("tag", f.tag);
  if (f.family) p.set("family", f.family);
  if (f.formalizedOnly) p.set("lean", "1");
  if (f.sort !== "importance") p.set("sort", f.sort);
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

const haystacks = new Map(
  papers.map(p => [
    p.slug,
    [p.title, p.summary, p.abstract, p.family.title, p.tags.join(" ")].join(" ").toLowerCase(),
  ]),
);

function matches(p: Paper, f: Filters, terms: string[]): boolean {
  if (f.discipline && p.family.discipline !== f.discipline) return false;
  if (p.importance < f.minImportance) return false;
  if (f.kinds.length && !f.kinds.includes(p.kind)) return false;
  if (f.tag && !p.tags.includes(f.tag)) return false;
  if (f.family && p.family.id !== f.family) return false;
  if (f.formalizedOnly && !p.formalized) return false;
  const hay = haystacks.get(p.slug)!;
  return terms.every(t => hay.includes(t));
}

const comparators: Record<Sort, (a: Paper, b: Paper) => number> = {
  importance: (a, b) => b.importance - a.importance || a.family.id.localeCompare(b.family.id),
  newest: (a, b) => b.date.localeCompare(a.date) || b.importance - a.importance,
  family: (a, b) => a.family.id.localeCompare(b.family.id) || b.importance - a.importance,
  title: (a, b) => a.title.localeCompare(b.title),
};


export function App() {
  const [f, setF] = useState<Filters>(readUrl);
  const [shown, setShown] = useState(PAGE);
  const [showAllTopics, setShowAllTopics] = useState(false);

  useEffect(() => {
    writeUrl(f);
    setShown(PAGE);
  }, [f]);

  const update = (patch: Partial<Filters>) => setF(prev => ({ ...prev, ...patch }));

  const results = useMemo(() => {
    const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    return papers.filter(p => matches(p, f, terms)).sort(comparators[f.sort]);
  }, [f]);

  const areaStats = useMemo(() => {
    const major = new Map<string, number>();
    for (const p of papers) if (p.importance >= 4) major.set(p.family.discipline, (major.get(p.family.discipline) ?? 0) + 1);
    return major;
  }, []);
  const maxCount = disciplines[0]?.count ?? 1;
  const activeFamily = f.family ? papers.find(p => p.family.id === f.family)?.family : undefined;
  const isFiltered = JSON.stringify({ ...f, sort: "importance" }) !== JSON.stringify(defaults);

  return (
    <div className="page">
      <header className="masthead">
        <h1>
          {papers.length} preprints, read and ranked
        </h1>
        <p className="lede">
          A browsable guide to the{" "}
          <a href="https://github.com/openai/math/tree/main/preprints">OpenAI math preprint collection</a>: every
          paper with a plain-language summary, an importance score from 1 to 5, and topic tags.
        </p>
        <p className="caveat">
          The papers were produced by an internal OpenAI model and many are not yet independently verified; only those
          marked <span className="lean-inline">Lean</span> ({papers.filter(p => p.formalized).length} of {papers.length}) have
          a machine-checked formalization, and its scope can be narrower than the paper.
          Summaries, scores and tags here were written by Claude Opus 5.5; the importance scores in particular are its
          subjective evaluations of what each paper claims, not peer review.
        </p>
      </header>

      <section className="areas" aria-labelledby="areas-heading">
        <h2 id="areas-heading">Browse by area</h2>
        <ul className="area-list">
          {disciplines.map(d => {
            const active = f.discipline === d.name;
            const major = areaStats.get(d.name) ?? 0;
            return (
              <li key={d.name}>
                <button
                  type="button"
                  className="area"
                  aria-pressed={active}
                  onClick={() => update({ discipline: active ? null : d.name, family: null })}
                >
                  <span className="area-name">{d.name}</span>
                  <span className="area-count">{d.count}</span>
                  <span className="area-bar" aria-hidden="true">
                    <span className="area-bar-all" style={{ width: `${(d.count / maxCount) * 100}%` }}>
                      <span className="area-bar-major" style={{ width: `${(major / d.count) * 100}%` }} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="legend">
          <span className="swatch swatch-major" aria-hidden="true" /> scored 4 or 5
          <span className="swatch swatch-all" aria-hidden="true" /> all papers
        </p>
      </section>

      <div className="layout">
        <aside className="filters" aria-label="Filters">
          <label className="field">
            <span className="field-label">Search</span>
            <input
              type="search"
              value={f.q}
              placeholder="Kakeya, matroid, Ricci flow…"
              onChange={e => update({ q: e.target.value })}
            />
          </label>

          <fieldset className="field">
            <legend className="field-label">Minimum importance</legend>
            <div className="segmented">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={f.minImportance === n}
                  title={importanceLabels[n]}
                  onClick={() => update({ minImportance: n })}
                >
                  {n === 1 ? "Any" : `${n}+`}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend className="field-label">Kind of result</legend>
            <div className="chips">
              {kinds.map(k => {
                const on = f.kinds.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    onClick={() => update({ kinds: on ? f.kinds.filter(x => x !== k) : [...f.kinds, k] })}
                  >
                    {kindLabels[k]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="check">
            <input
              type="checkbox"
              checked={f.formalizedOnly}
              onChange={e => update({ formalizedOnly: e.target.checked })}
            />
            Only papers with a Lean formalization
          </label>

          <label className="field">
            <span className="field-label">Sort by</span>
            <select value={f.sort} onChange={e => update({ sort: e.target.value as Sort })}>
              <option value="importance">Importance</option>
              <option value="newest">Newest first</option>
              <option value="family">Result family</option>
              <option value="title">Title</option>
            </select>
          </label>

          <fieldset className="field">
            <legend className="field-label">Common topics</legend>
            <div className="chips">
              {(showAllTopics ? TOP_TAGS : TOP_TAGS.slice(0, TOPICS_COLLAPSED)).map(({ tag, count }) => (
                <button
                  key={tag}
                  type="button"
                  className="chip chip-tag"
                  aria-pressed={f.tag === tag}
                  onClick={() => update({ tag: f.tag === tag ? null : tag })}
                >
                  {tagName(tag)} <span className="chip-count">{count}</span>
                </button>
              ))}
            </div>
            <button type="button" className="link-button" onClick={() => setShowAllTopics(v => !v)}>
              {showAllTopics ? "Show fewer topics" : `Show ${TOP_TAGS.length - TOPICS_COLLAPSED} more topics`}
            </button>
          </fieldset>
        </aside>

        <main className="results">
          <div className="status" aria-live="polite">
            <p>
              <strong>{results.length}</strong> {results.length === 1 ? "paper" : "papers"}
              {f.discipline && <> in {f.discipline}</>}
              {f.tag && <> tagged “{tagName(f.tag)}”</>}
              {activeFamily && (
                <>
                  {" "}
                  in family {activeFamily.id}, <MathText text={activeFamily.title} />
                </>
              )}
            </p>
            {isFiltered && (
              <button type="button" className="link-button" onClick={() => setF({ ...defaults, sort: f.sort })}>
                Clear filters
              </button>
            )}
          </div>

          {activeFamily && (
            <p className="family-note">
              <MathText text={activeFamily.description} />
            </p>
          )}

          {results.length === 0 ? (
            <p className="empty">No papers match these filters. Try a lower importance or clear the search.</p>
          ) : (
            <ol className="paper-list">
              {results.slice(0, shown).map(p => (
                <PaperItem
                  key={p.slug}
                  paper={p}
                  onTag={tag => update({ tag })}
                  onFamily={family => update({ family, discipline: null })}
                />
              ))}
            </ol>
          )}

          {shown < results.length && (
            <button type="button" className="more" onClick={() => setShown(s => s + PAGE)}>
              Show {Math.min(PAGE, results.length - shown)} more of {results.length - shown} remaining
            </button>
          )}
        </main>
      </div>

      <footer className="footer">
        <p>
          Data from <a href={`https://github.com/${source.repo}/tree/${source.ref}`}>{source.repo}</a> at commit{" "}
          <code>{source.ref.slice(0, 7)}</code>, fetched {source.fetchedAt.slice(0, 10)}. Paper titles, abstracts and
          families come from the repository's catalogue; everything else is editorial.
        </p>
      </footer>
    </div>
  );
}

function Importance({ value }: { value: number }) {
  return (
    <span className={`importance importance-${value}`} title={importanceLabels[value]}>
      <span className="importance-marks" aria-hidden="true">
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} className={i <= value ? "mark on" : "mark"} />
        ))}
      </span>
      <span className="sr-only">Importance {value} of 5: {importanceLabels[value]}</span>
    </span>
  );
}

function PaperItem({
  paper: p,
  onTag,
  onFamily,
}: {
  paper: Paper;
  onTag: (tag: string) => void;
  onFamily: (id: string) => void;
}) {
  return (
    <li className="paper">
      <div className="paper-side">
        <Importance value={p.importance} />
        <span className="score" aria-hidden="true">
          {p.importance}
        </span>
      </div>
      <article className="paper-body">
        <p className="meta">
          <span className={`kind kind-${p.kind}`}>{kindLabels[p.kind]}</span>
          <span>{p.family.discipline}</span>
          <time dateTime={p.date}>
            {new Date(p.date + "T00:00:00Z").toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            })}
          </time>
          {p.leanUrl && (
            <a className="lean" href={p.leanUrl} title="See which statements the Lean formalization covers">
              Lean
            </a>
          )}
        </p>
        <h3 className="paper-title">
          <a href={p.pdfUrl}>
            <MathText text={p.title} />
          </a>
        </h3>
        <p className="summary">{p.summary}</p>
        <div className="paper-foot">
          <ul className="tags" aria-label="Topics">
            {p.tags.map(t => (
              <li key={t}>
                <button type="button" className="tag" onClick={() => onTag(t)}>
                  {tagName(t)}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="family-link" onClick={() => onFamily(p.family.id)}>
            Family {p.family.id}: <MathText text={p.family.title} />
          </button>
        </div>
        <details className="abstract">
          <summary>Original abstract</summary>
          <p>
            <MathText text={p.abstract} />
          </p>
          <p className="abstract-links">
            <a href={p.pdfUrl}>Read the PDF</a>
            <a href={p.dirUrl}>Source files and citation</a>
            {p.leanUrl && <a href={p.leanUrl}>Lean formalization scope</a>}
          </p>
        </details>
      </article>
    </li>
  );
}

export default App;
