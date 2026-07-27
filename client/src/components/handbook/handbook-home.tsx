import type { JSX } from "react";
import Link from "next/link";
import { ArrowRight, Compass, Map } from "lucide-react";
import { handbookDocuments } from "@/lib/handbook";

/*
 * Úvodní stránka Handbooku — dvě karty (Doctrine, Master Roadmap).
 * Bez marketingu, sloganů a vymyšlených čísel. Server-rendered.
 */

const CARDS = [
  {
    slug: "doctrine" as const,
    href: "/handbook/doctrine",
    icon: Compass,
  },
  {
    slug: "master-roadmap" as const,
    href: "/handbook/master-roadmap",
    icon: Map,
  },
];

export function HandbookHome(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Eduto Handbook
        </h1>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Strategické principy, produktová doktrína a aktuální pořadí práce na
          projektu Eduto.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map(({ slug, href, icon: Icon }) => {
          const doc = handbookDocuments[slug];
          return (
            <Link
              key={slug}
              href={href}
              className="group flex flex-col rounded-xl border border-line bg-canvas-alt p-6 transition-colors hover:border-line-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft">
                <Icon className="h-5 w-5 text-accent-deep" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold text-ink">{doc.title}</h2>
              <p className="mt-1 flex-1 text-sm text-ink-muted">
                {doc.description}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-deep">
                Otevřít
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
