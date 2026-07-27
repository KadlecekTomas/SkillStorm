import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HandbookHome } from "@/components/handbook/handbook-home";
import { HandbookDocumentView } from "@/components/handbook/handbook-document-view";
import { MarkdownDocument } from "@/components/handbook/markdown-document";
import { extractTableOfContents, loadHandbookDocument } from "@/lib/handbook";

/*
 * Komponentové testy Handbooku — render v jsdom.
 * MSW je nastaven s onUnhandledRequest: "error", takže jakýkoli síťový
 * fetch během renderu by test shodil → důkaz, že se Markdown nefetchuje.
 */

describe("HandbookHome (/handbook)", () => {
  it("vykreslí se a nese název Handbooku", () => {
    render(<HandbookHome />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Eduto Handbook" }),
    ).toBeInTheDocument();
  });

  it("obsahuje odkaz na Doctrine", () => {
    render(<HandbookHome />);
    const link = screen.getByRole("link", { name: /Doctrine/i });
    expect(link).toHaveAttribute("href", "/handbook/doctrine");
  });

  it("obsahuje odkaz na Master Roadmap", () => {
    render(<HandbookHome />);
    const link = screen.getByRole("link", { name: /Master Roadmap/i });
    expect(link).toHaveAttribute("href", "/handbook/master-roadmap");
  });
});

describe("MarkdownDocument — vykreslení GFM", () => {
  it("Markdown tabulka se vykreslí jako <table>", () => {
    const md = ["| A | B |", "|---|---|", "| 1 | 2 |"].join("\n");
    render(<MarkdownDocument markdown={md} />);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "A" })).toBeInTheDocument();
  });

  it("nadpis dostane stabilní id (slug) shodné s TOC", () => {
    const md = "## Zakladatelská teze\n\nText.";
    const { container } = render(<MarkdownDocument markdown={md} />);
    const toc = extractTableOfContents(md);
    const firstId = toc[0]?.id ?? "";
    const heading = container.querySelector(`#${CSS.escape(firstId)}`);
    expect(heading).not.toBeNull();
    expect(heading?.tagName).toBe("H2");
  });

  it("externí odkaz je bezpečný (target + rel), interní kotva zůstává", () => {
    const md = "[ven](https://example.com) a [sem](#sekce).";
    render(<MarkdownDocument markdown={md} />);
    const external = screen.getByRole("link", { name: "ven" });
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).toHaveAttribute("rel", "noopener noreferrer");
    const internal = screen.getByRole("link", { name: "sem" });
    expect(internal).toHaveAttribute("href", "#sekce");
    expect(internal).not.toHaveAttribute("target");
  });

  it("blockquote a code block se vykreslí", () => {
    const md = ["> Důležité.", "", "```", "kod();", "```"].join("\n");
    const { container } = render(<MarkdownDocument markdown={md} />);
    expect(container.querySelector("blockquote")).not.toBeNull();
    expect(container.querySelector("pre code")).not.toBeNull();
  });
});

describe("HandbookDocumentView — každá položka TOC míří na existující kotvu", () => {
  it("Doctrine: každé id z TOC existuje jako nadpis v dokumentu", () => {
    const doc = loadHandbookDocument("doctrine");
    const toc = extractTableOfContents(doc.markdown);
    const { container } = render(
      <HandbookDocumentView
        slug="doctrine"
        title={doc.title}
        description={doc.description}
        markdown={doc.markdown}
        toc={toc}
      />,
    );
    // Namátkově prvních 8 položek — každá kotva musí mít cíl v dokumentu.
    for (const item of toc.slice(0, 8)) {
      const target = container.querySelector(`#${CSS.escape(item.id)}`);
      expect(target, `chybí kotva #${item.id}`).not.toBeNull();
    }
    // TOC odkaz i cíl existují (obsah → anchor).
    const first = toc[0];
    expect(first).toBeDefined();
    const tocLink = screen.getAllByRole("link", { name: first!.text })[0];
    expect(tocLink).toHaveAttribute("href", `#${first!.id}`);
  });

  it("obsahuje odkaz zpět na /handbook a přepnutí na druhý dokument", () => {
    const doc = loadHandbookDocument("doctrine");
    render(
      <HandbookDocumentView
        slug="doctrine"
        title={doc.title}
        description={doc.description}
        markdown={doc.markdown}
        toc={extractTableOfContents(doc.markdown)}
      />,
    );
    expect(
      screen.getByRole("link", { name: /Zpět na Handbook/i }),
    ).toHaveAttribute("href", "/handbook");
    expect(
      screen.getByRole("link", { name: /Master Roadmap/i }),
    ).toHaveAttribute("href", "/handbook/master-roadmap");
  });
});
