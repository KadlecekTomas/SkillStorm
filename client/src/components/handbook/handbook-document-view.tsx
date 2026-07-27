import type { JSX } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { HandbookSlug, TocItem } from "@/lib/handbook";
import { handbookDocuments } from "@/lib/handbook";
import { MarkdownDocument } from "./markdown-document";
import { TableOfContents } from "./table-of-contents";

/*
 * HandbookDocumentView — layout jednoho dokumentu.
 *
 *  ┌───────────────────┬──────────────────────────────┐
 *  │ Obsah (sticky)    │ Nadpis + popis                │
 *  │                   │ Markdown dokument             │
 *  │                   │ ← zpět / přepnout na druhý →   │
 *  └───────────────────┴──────────────────────────────┘
 *
 * Server component: staticky vykreslené, bez klientského JS.
 */

const OTHER: Record<HandbookSlug, HandbookSlug> = {
  doctrine: "master-roadmap",
  "master-roadmap": "doctrine",
};

export function HandbookDocumentView({
  slug,
  title,
  description,
  markdown,
  toc,
}: {
  slug: HandbookSlug;
  title: string;
  description: string;
  markdown: string;
  toc: TocItem[];
}): JSX.Element {
  const otherSlug = OTHER[slug];
  const other = handbookDocuments[otherSlug];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
        {/* Levý sloupec — obsah dokumentu */}
        <aside className="mb-6 lg:mb-0">
          <div className="lg:sticky lg:top-8">
            <TableOfContents items={toc} />
          </div>
        </aside>

        {/* Hlavní obsah — omezená šířka pro čitelnost (~72ch) */}
        <div className="min-w-0">
          <header className="mb-8 border-b border-line pb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-dim">
              Eduto Handbook
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-ink-muted">{description}</p>
          </header>

          <article className="handbook-measure">
            <MarkdownDocument markdown={markdown} />
          </article>

          <footer className="mt-12 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/handbook"
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Zpět na Handbook
            </Link>
            <Link
              href={`/handbook/${otherSlug}`}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-canvas-alt px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface"
            >
              {other.title}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </footer>
        </div>
      </div>
    </div>
  );
}
