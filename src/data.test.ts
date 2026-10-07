import { test, expect } from "bun:test";
import catalogue from "../data/catalogue.json";
import annotations from "../data/annotations.json";
import { kindLabels, papers } from "./data";

test("every paper has exactly one annotation", () => {
  const slugs = new Set(catalogue.papers.map(p => p.slug));
  expect(slugs.size).toBe(catalogue.papers.length);
  expect(Object.keys(annotations).sort()).toEqual([...slugs].sort());
});

test("annotations are well formed", () => {
  for (const p of papers) {
    expect(p.importance).toBeGreaterThanOrEqual(1);
    expect(p.importance).toBeLessThanOrEqual(5);
    expect(Object.keys(kindLabels)).toContain(p.kind);
    expect(p.tags.length).toBeGreaterThan(0);
    for (const t of p.tags) expect(t).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(p.summary.length).toBeGreaterThan(40);
  }
});
