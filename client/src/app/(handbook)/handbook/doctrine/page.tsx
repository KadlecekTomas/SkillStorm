import type { JSX } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HandbookDocumentView } from "@/components/handbook/handbook-document-view";
import {
  HandbookDocumentNotFoundError,
  extractTableOfContents,
  handbookDocuments,
  loadHandbookDocument,
} from "@/lib/handbook";

// Staticky generováno při buildu (Markdown se čte ze souboru na serveru).
export const dynamic = "force-static";

const SLUG = "doctrine" as const;

export const metadata: Metadata = {
  title: `${handbookDocuments[SLUG].title} — Eduto Handbook`,
  description: handbookDocuments[SLUG].description,
  robots: { index: false, follow: false },
};

export default function DoctrinePage(): JSX.Element {
  let doc;
  try {
    doc = loadHandbookDocument(SLUG);
  } catch (error) {
    if (error instanceof HandbookDocumentNotFoundError) notFound();
    throw error;
  }

  const toc = extractTableOfContents(doc.markdown);

  return (
    <HandbookDocumentView
      slug={SLUG}
      title={doc.title}
      description={doc.description}
      markdown={doc.markdown}
      toc={toc}
    />
  );
}
