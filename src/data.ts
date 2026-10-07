/**
 * Joins the scraped catalogue (facts from openai/math) with the editorial
 * annotations (summary, importance, kind, tags). Both are baked in at build time.
 */
import catalogue from "../data/catalogue.json";
import annotations from "../data/annotations.json";

export type Kind = "proof" | "counterexample" | "bound" | "algorithm" | "construction" | "partial";

export type Annotation = {
  summary: string;
  importance: number;
  kind: Kind;
  tags: string[];
};

export type Family = { id: string; title: string; description: string; discipline: string };

export type Paper = {
  slug: string;
  title: string;
  date: string;
  family: Family;
  abstract: string;
  pdfUrl: string;
  dirUrl: string;
  formalized: boolean;
  /** Document describing the scope of the Lean formalization, when there is one. */
  leanUrl: string | null;
} & Annotation;

const families = new Map<string, Family>(catalogue.families.map(f => [f.id, f]));
const notes = annotations as Record<string, Annotation>;

export const papers: Paper[] = catalogue.papers.map(p => {
  const family = families.get(p.family);
  const note = notes[p.slug];
  if (!family || !note) throw new Error(`Incomplete data for ${p.slug}`);
  return { ...p, family, ...note };
});

export const source = catalogue.source;

export const kindLabels: Record<Kind, string> = {
  proof: "Proof",
  counterexample: "Counterexample",
  bound: "New bound",
  algorithm: "Algorithm",
  construction: "Construction",
  partial: "Partial or conditional",
};

export const importanceLabels: Record<number, string> = {
  5: "Landmark: settles a famous, long-open problem",
  4: "Major: resolves a well-known conjecture in its field",
  3: "Significant: notable new result",
  2: "Supporting: special case, companion or technical step",
  1: "Minor: conditional or narrow",
};

/** Disciplines ordered by number of papers, descending. */
export const disciplines: { name: string; count: number }[] = Object.entries(
  papers.reduce<Record<string, number>>((acc, p) => {
    acc[p.family.discipline] = (acc[p.family.discipline] ?? 0) + 1;
    return acc;
  }, {}),
)
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count);

/** Tags with their frequency, descending. */
export const tagCounts: { tag: string; count: number }[] = Object.entries(
  papers.reduce<Record<string, number>>((acc, p) => {
    for (const t of p.tags) acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {}),
)
  .map(([tag, count]) => ({ tag, count }))
  .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

/* Display names for tags. Tags are kebab-case slugs; names restore capitalization,
   accents and the en dashes between paired surnames. */

const tagOverrides: Record<string, string> = {
  "p-equals-w": "P = W",
  "c-star-algebras": "C*-algebras",
  "group-c-star-algebras": "group C*-algebras",
  "k-pi-1-conjecture": "K(π,1) conjecture",
  "2-to-1-games": "2-to-1 games",
  "de-giorgi-conjecture": "De Giorgi conjecture",
  "type-iii-factors": "type III factors",
  "l2-invariants": "L² invariants",
  "l2-betti-numbers": "L² Betti numbers",
  "l1-embeddings": "L¹ embeddings",
  "lane-emden": "Lane–Emden",
  "monge-ampere": "Monge–Ampère",
  "anti-de-sitter": "anti-de Sitter",
  "self-avoiding-walk": "self-avoiding walk",
  "random-walk-random-environment": "random walk in random environment",
  "kadison-kastler": "Kadison–Kastler",
  "calderon-problem": "Calderón problem",
  "k3-surfaces": "K3 surfaces",
  "colin-de-verdiere": "Colin de Verdière",
};

const acronyms = new Set(
  "sle cle qma ppad pcp bsd rcd mtw mcmc bkt bfss qaoa syz iid xy zfc dft voa kms sat ii iii".split(" "),
);

const properNames: Record<string, string> = {
  kahler: "Kähler",
  erdos: "Erdős",
  schrodinger: "Schrödinger",
  szemeredi: "Szemerédi",
  sarkozy: "Sárközy",
  cat0: "CAT(0)",
  hyperkahler: "hyperkähler",
  boolean: "Boolean",
  riemannian: "Riemannian",
  hamiltonian: "Hamiltonian",
};

const surnames = new Set(
  (
    "penrose langlands banach yau stokes navier ramsey gaussian hilbert fourier liouville kadison ising hodge einstein " +
    "bose kaplansky calabi ricci kodaira iitaka fano artin arnold zariski weisfeiler leman sobolev seshadri lipschitz " +
    "heisenberg gromov boltzmann toms winter thirring lieb smith toda singer selmer satake kuga markov mahler littlewood " +
    "kerr newman hadamard galois bloch anderson weil virasoro thomas fermi shafarevich ryser riesz riemann ramanujan " +
    "potts novikov baum connes lax kervaire kakeya jiang su haldane hadwiger gersten foulkes euler donovan crouzeix " +
    "burnside bernoulli bass vlasov turing tingley thompson tate tachikawa strickland hovey stembridge stanley steinitz " +
    "sipser sakoda siegel sidorenko shah mumford serre saxl reiten auslander quillen peternell campana oka nakayama " +
    "naimark nagata mukai minkowski brunn macaulay cohen lusztig kazhdan lipman lech kurosh koebe kobayashi kirchberg " +
    "kalai kahn jacobsthal hindman hikita heilbronn hecke harris green eisenbud hahn wilson grothendieck floer falconer " +
    "daugavet chowla cannon brownian brennan borel bochner blaschke barnette barker alperin alexandrov wall dirichlet " +
    "zilber pink katok gigli villani chern pfaffian thorp nienhuis bogoliubov bloch alperin dixmier ulam kervaire " +
    "eilenberg ganea higman boone howie gersten gaboriau tits schramm cardy kesten stigum parisi mezard sherrington " +
    "kirkpatrick laughlin hall mott nelson ball evans allen cahn bernstein neumann voronoi shimura urysohn sitter"
  ).split(" "),
);

export function tagName(tag: string): string {
  const override = tagOverrides[tag];
  if (override) return override;
  const words = tag.split("-");
  let out = "";
  words.forEach((w, i) => {
    const prev = words[i - 1];
    let shown: string;
    if (properNames[w]) shown = properNames[w];
    else if (acronyms.has(w)) shown = w.toUpperCase();
    else if (w.length === 1 && /[a-z]/.test(w)) shown = w.toUpperCase();
    else if (surnames.has(w)) shown = w[0]!.toUpperCase() + w.slice(1);
    else shown = w;
    if (i === 0) out = shown;
    else if (prev && /^[0-9]+$/.test(prev)) out += "-" + shown; // 3-manifolds
    else if (prev && prev.length === 1 && /[a-z]/.test(prev)) out += "-" + shown; // L-functions, K-theory
    else if (prev && (surnames.has(prev) || properNames[prev]) && (surnames.has(w) || properNames[w])) out += "–" + shown;
    else out += " " + shown;
  });
  return out;
}
