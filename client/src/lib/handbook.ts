import { readFileSync } from "node:fs";
import path from "node:path";
import GithubSlugger from "github-slugger";

/**
 * Handbook — statická interní dokumentace nad Markdown soubory v `docs/`.
 *
 * Zásady:
 *  - Markdown v `docs/roadmap/*.md` je JEDINÝ zdroj pravdy. Obsah se sem
 *    nekopíruje ani neduplikuje; čte se ze souboru na serveru při buildu.
 *  - `loadHandbookDocument` používá `fs` → jen server / build-time.
 *  - `extractTableOfContents` je čistá funkce (bez fs) → testovatelná a
 *    použitelná i pro sestavení obsahu (TOC).
 */

export type HandbookSlug = "doctrine" | "master-roadmap";

export interface HandbookDocumentMeta {
  /** Nadpis stránky (nezávislý na H1 uvnitř dokumentu). */
  title: string;
  /** Krátký popis pro úvodní kartu a `<meta description>`. */
  description: string;
  /** Cesta k Markdown souboru relativně ke kořeni repozitáře. */
  sourcePath: string;
}

/**
 * Interní konfigurace dokumentů. Neobsahuje obsah — jen metadata a odkaz
 * na skutečný soubor, který zůstává zdrojem pravdy.
 */
export const handbookDocuments: Record<HandbookSlug, HandbookDocumentMeta> = {
  doctrine: {
    title: "Eduto Doctrine",
    description:
      "Proč Eduto existuje, jaké problémy řeší, podle jakých principů se rozhoduje a jaká je dlouhodobá strategie.",
    sourcePath: "docs/roadmap/doctrine.md",
  },
  "master-roadmap": {
    title: "Master Roadmap",
    description:
      "Aktuální stav projektu, pořadí vertikál, závislosti, pilotní brány a nejbližší priority.",
    sourcePath: "docs/roadmap/master.md",
  },
};

export const handbookSlugs = Object.keys(handbookDocuments) as HandbookSlug[];

export function isHandbookSlug(value: string): value is HandbookSlug {
  return Object.prototype.hasOwnProperty.call(handbookDocuments, value);
}

/** Chyba s jasnou identitou pro chybějící/nečitelný dokument. */
export class HandbookDocumentNotFoundError extends Error {
  constructor(slug: string) {
    super(`Handbook document not found: ${slug}`);
    this.name = "HandbookDocumentNotFoundError";
  }
}

/**
 * Najde kořen repozitáře tak, že od `process.cwd()` stoupá nahoru a hledá
 * adresář, který obsahuje daný relativní `sourcePath`. Funguje jak když je
 * cwd `client/` (next build, vitest), tak z kořene monorepa.
 */
function resolveFromRepoRoot(sourcePath: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, sourcePath);
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  // Poslední pokus: relativně k cwd (nechť případná chyba probublá výš).
  return path.join(process.cwd(), sourcePath);
}

export interface HandbookDocument extends HandbookDocumentMeta {
  slug: HandbookSlug;
  /** Surový Markdown ze souboru. */
  markdown: string;
}

/**
 * Načte Markdown dokument ze souboru (server / build-time).
 * Vyhodí `HandbookDocumentNotFoundError`, pokud slug neexistuje nebo se
 * soubor nepodaří přečíst — volající stránka na to reaguje `notFound()`.
 */
export function loadHandbookDocument(slug: string): HandbookDocument {
  if (!isHandbookSlug(slug)) {
    throw new HandbookDocumentNotFoundError(slug);
  }
  const meta = handbookDocuments[slug];
  try {
    const filePath = resolveFromRepoRoot(meta.sourcePath);
    const markdown = readFileSync(filePath, "utf8");
    return { slug, markdown, ...meta };
  } catch (error) {
    if (error instanceof HandbookDocumentNotFoundError) throw error;
    throw new HandbookDocumentNotFoundError(slug);
  }
}

export interface TocItem {
  /** 2 = H2, 3 = H3. */
  depth: 2 | 3;
  /** Viditelný text nadpisu (bez inline Markdown značek). */
  text: string;
  /** Slug shodný s `rehype-slug` → cíl kotvy. */
  id: string;
}

/** Odstraní běžné inline Markdown značky, aby text odpovídal vykreslenému. */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1") // strikethrough
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .trim();
}

/**
 * Sestaví obsah (TOC) z nadpisů H2 a H3.
 *
 * Slugy se počítají STEJNÝM slugerem (`github-slugger`) jako v `rehype-slug`,
 * a to přes VŠECHNY nadpisy v pořadí dokumentu — tím se stav čítače duplicit
 * shoduje a kotvy vždy sedí. Do TOC se zařadí jen H2/H3.
 *
 * Řádky uvnitř fenced code bloků (``` / ~~~) se ignorují.
 */
export function extractTableOfContents(markdown: string): TocItem[] {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  let inFence = false;
  let fenceMarker = "";

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    const fence = line.match(/^\s*(```+|~~~+)/);
    if (fence) {
      const marker = fence[1]?.[0] ?? "";
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = "";
      }
      continue;
    }
    if (inFence) continue;

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (!heading) continue;

    const depth = (heading[1] ?? "").length;
    const text = stripInlineMarkdown((heading[2] ?? "").replace(/\s+#*\s*$/, ""));
    // Slug počítáme pro KAŽDÝ nadpis, aby čítač duplicit odpovídal rehype-slug.
    const id = slugger.slug(text);
    if (depth === 2 || depth === 3) {
      items.push({ depth, text, id });
    }
  }

  return items;
}
