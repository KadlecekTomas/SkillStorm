import type { JSX } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

/*
 * MarkdownDocument — bezpečné vykreslení Markdownu z repozitáře.
 *
 * Server component (žádné "use client"): vykreslí se staticky při buildu,
 * do klienta neteče Markdown ani parser.
 *
 * Bezpečnost:
 *  - react-markdown NEpoužívá `dangerouslySetInnerHTML`; raw HTML v Markdownu
 *    se standardně ignoruje (nepřidáváme `rehype-raw`). Žádné skripty.
 *  - Externí odkazy dostanou `target="_blank"` + `rel="noopener noreferrer"`.
 *
 * Kotvy:
 *  - `rehype-slug` přidá `id` na nadpisy (shodné se slugy v TOC).
 *  - `rehype-autolink-headings` zpřístupní kotvu přímo z nadpisu.
 */

function isExternalHref(href: string | undefined): boolean {
  if (!href) return false;
  return /^(https?:)?\/\//i.test(href) || href.startsWith("mailto:");
}

const components: Components = {
  a({ node, href, children, ...props }) {
    void node; // react-markdown předává `node`; na DOM ho nepropouštíme
    if (isExternalHref(href)) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    }
    // Interní kotvy (#…) i relativní odkazy zůstávají na stejné stránce.
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
  // Tabulky obalíme scroll kontejnerem → na mobilu se posouvají vodorovně
  // a nezpůsobí přetečení celé stránky.
  table({ node, children, ...props }) {
    void node;
    return (
      <div className="handbook-table-scroll">
        <table {...props}>{children}</table>
      </div>
    );
  },
};

const remarkPlugins = [remarkGfm];
const rehypePlugins = [
  rehypeSlug,
  [
    rehypeAutolinkHeadings,
    {
      behavior: "append",
      properties: {
        className: ["handbook-anchor"],
        ariaLabel: "Odkaz na tuto sekci",
        tabIndex: -1,
      },
      content: { type: "text", value: "#" },
    },
  ],
] as const;

export function MarkdownDocument({
  markdown,
}: {
  markdown: string;
}): JSX.Element {
  return (
    <div className="handbook-prose">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rehypePlugins={rehypePlugins as any}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
