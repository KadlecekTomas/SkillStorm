import type { JSX } from "react";
import type { TocItem } from "@/lib/handbook";

/*
 * Obsah dokumentu (TOC) — server-rendered seznam kotvových odkazů.
 * Žádný klientský JS: aktivní sekce se nezvýrazňuje (dle zadání volitelné).
 * Na desktopu sticky v levém sloupci, na mobilu sbalitelný přes <details>.
 */

function TocList({ items }: { items: TocItem[] }): JSX.Element {
  return (
    <ul className="space-y-1 text-sm">
      {items.map((item, index) => (
        <li key={`${item.id}-${index}`}>
          <a
            href={`#${item.id}`}
            className={
              item.depth === 3
                ? "block rounded px-2 py-1 pl-5 text-ink-muted hover:bg-surface hover:text-ink"
                : "block rounded px-2 py-1 font-medium text-ink-muted hover:bg-surface hover:text-ink"
            }
          >
            {item.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function TableOfContents({ items }: { items: TocItem[] }): JSX.Element | null {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Obsah dokumentu" className="handbook-toc">
      {/* Desktop: sticky sloupec */}
      <div className="hidden lg:block">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Obsah dokumentu
        </p>
        <TocList items={items} />
      </div>

      {/* Mobil: sbalitelný, nezabírá trvale levou část obrazovky */}
      <details className="rounded-xl border border-line bg-canvas-alt lg:hidden">
        <summary className="cursor-pointer select-none rounded-xl px-4 py-3 text-sm font-semibold text-ink">
          Obsah dokumentu
        </summary>
        <div className="border-t border-line px-2 py-2">
          <TocList items={items} />
        </div>
      </details>
    </nav>
  );
}
