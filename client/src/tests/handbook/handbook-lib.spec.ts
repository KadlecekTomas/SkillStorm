import { describe, expect, it } from "vitest";
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
 */

describe("loadHandbookDocument", () => {
  it("načte skutečný Doctrine Markdown ze souboru", () => {
    const doc = loadHandbookDocument("doctrine");
    expect(doc.slug).toBe("doctrine");
    expect(doc.sourcePath).toBe("docs/roadmap/doctrine.md");
    // Obsah pochází ze skutečného souboru (H1 dokumentu).
    expect(doc.markdown).toContain("THE EDUTO DOCTRINE");
    expect(doc.markdown.length).toBeGreaterThan(1000);
  });

  it("načte skutečný Master Roadmap Markdown ze souboru", () => {
    const doc = loadHandbookDocument("master-roadmap");
    expect(doc.slug).toBe("master-roadmap");
    expect(doc.sourcePath).toBe("docs/roadmap/master.md");
    expect(doc.markdown).toContain("Master Roadmap");
    expect(doc.markdown).toContain("| Oblast | Stav |"); // tabulka je zdroj pravdy
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
    // slug si diakritiku zachovává (nezmění na prázdné id)
    expect(toc[0]?.id).toBe("zakladatelská-teze");
  });

  it("duplicitní nadpisy dostanou jedinečné slugy jako rehype-slug", () => {
    const md = ["## Fáze A — Česko", "### Detail", "## Fáze A — Česko"].join(
      "\n",
    );
    const toc = extractTableOfContents(md);
    const h2 = toc.filter((t) => t.depth === 2);
    expect(h2[0]?.id).not.toBe(h2[1]?.id);
    expect(h2[1]?.id).toMatch(/-1$/);
  });

  it("skutečný Doctrine dokument vyprodukuje neprázdný obsah", () => {
    const doc = loadHandbookDocument("doctrine");
    const toc = extractTableOfContents(doc.markdown);
    expect(toc.length).toBeGreaterThan(5);
    for (const item of toc) {
      expect(item.id).toBeTruthy();
      expect(item.text).toBeTruthy();
    }
  });
});
