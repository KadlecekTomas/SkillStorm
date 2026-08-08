import { describe, expect, it, vi } from "vitest";
import GithubSlugger from "github-slugger";
import {
  HandbookDocumentNotFoundError,
  extractTableOfContents,
  handbookDocuments,
  isHandbookSlug,
  loadHandbookDocument,
} from "@/lib/handbook";

/*
 * Knihovní testy Handbooku — bez DB, bez API, bez sítě.
 * loadHandbookDocument čte skutečné Markdown soubory z repozitáře přes fs.
 * Testujeme současný lifecycle kontrakt dokumentů, ne historickou kopii textu.
 */

describe("loadHandbookDocument", () => {
  it("načte skutečný superseded Doctrine Markdown ze souboru", () => {
    const doc = loadHandbookDocument("doctrine");
    expect(doc.slug).toBe("doctrine");
    expect(doc.sourcePath).toBe("docs/roadmap/doctrine.md");
    expect(doc.markdown).toContain("SkillStorm — Superseded Founding Doctrine");
    expect(doc.markdown).toContain("**Status:** `SUPERSEDED`");
    expect(doc.markdown).toContain("This document is not authoritative");
    expect(doc.markdown.length).toBeGreaterThan(1000);
  });

  it("načte skutečný current Master Roadmap Markdown ze souboru", () => {
    const doc = loadHandbookDocument("master-roadmap");
    expect(doc.slug).toBe("master-roadmap");
    expect(doc.sourcePath).toBe("docs/roadmap/master.md");
    expect(doc.markdown).toContain("SkillStorm — Master Roadmap");
    expect(doc.markdown).toContain("**Status:** `CURRENT / NORMATIVE`");
    expect(doc.markdown).toContain("Definition of Ready");
    expect(doc.markdown).toContain("Interactive IT Lab — první subject vertical");
  });

  it("neexistující dokument skončí bezpečně (typed error)", () => {
    expect(() => loadHandbookDocument("neexistuje")).toThrow(
      HandbookDocumentNotFoundError,
    );
  });

  it("neprovádí žádný síťový fetch (build bez API/DB)", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    loadHandbookDocument("doctrine");
    loadHandbookDocument("master-roadmap");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("isHandbookSlug", () => {
  it("rozpozná platné a neplatné slugy", () => {
    expect(isHandbookSlug("doctrine")).toBe(true);
    expect(isHandbookSlug("master-roadmap")).toBe(true);
    expect(isHandbookSlug("nope")).toBe(false);
  });

  it("konfigurace obsahuje oba dokumenty s title/description/sourcePath", () => {
    for (const meta of Object.values(handbookDocuments)) {
      expect(meta.title).toBeTruthy();
      expect(meta.description).toBeTruthy();
      expect(meta.sourcePath).toMatch(/\.md$/);
    }
  });
});

describe("extractTableOfContents", () => {
  it("sestaví obsah z H2 a H3, ignoruje H1/H4", () => {
    const md = [
      "# Titulek",
      "## První kapitola",
      "### Podsekce",
      "#### Detail (mimo TOC)",
      "## Druhá kapitola",
    ].join("\n");
    const toc = extractTableOfContents(md);
    expect(toc.map((t) => t.text)).toEqual([
      "První kapitola",
      "Podsekce",
      "Druhá kapitola",
    ]);
    expect(toc.map((t) => t.depth)).toEqual([2, 3, 2]);
  });

  it("ignoruje nadpisy uvnitř fenced code bloků", () => {
    const md = ["## Skutečná sekce", "```", "## Toto není nadpis", "```"].join(
      "\n",
    );
    const toc = extractTableOfContents(md);
    expect(toc).toHaveLength(1);
    expect(toc[0]?.text).toBe("Skutečná sekce");
  });

  it("české nadpisy s diakritikou mají stabilní slug shodný s github-slugger", () => {
    const md = "## Zakladatelská teze";
    const toc = extractTableOfContents(md);
    const expected = new GithubSlugger().slug("Zakladatelská teze");
    expect(toc[0]?.id).toBe(expected);
    expect(toc[0]?.id).toBe("zakladatelská-teze");
  });

  it("duplicitní nadpisy dostanou jedinečné slugy jako rehype-slug", () => {
    const md = ["## Fáze A — Česko", "### Detail", "## Fáze A — Česko"].join("\n");
    const toc = extractTableOfContents(md);
    const h2 = toc.filter((t) => t.depth === 2);
    expect(h2[0]?.id).not.toBe(h2[1]?.id);
    expect(h2[1]?.id).toMatch(/-1$/);
  });

  it("superseded Doctrine dokument stále poskytuje stabilní navigační obsah", () => {
    const doc = loadHandbookDocument("doctrine");
    const toc = extractTableOfContents(doc.markdown);
    expect(toc.length).toBeGreaterThanOrEqual(2);
    expect(toc.map((item) => item.text)).toContain("This document is not authoritative");
    expect(toc.map((item) => item.text)).toContain("Final invariant");
    for (const item of toc) {
      expect(item.id).toBeTruthy();
      expect(item.text).toBeTruthy();
    }
  });
});
