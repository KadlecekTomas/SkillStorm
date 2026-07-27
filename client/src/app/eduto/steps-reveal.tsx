"use client";

import { useEffect, useRef } from "react";

/**
 * Jediný scroll-triggered reveal na stránce (sekce 03).
 * Sděluje jednu věc: tři ruční kroky zmizí a zůstane jeden.
 * Spustí se jednou, pak observer odpojí. Zbytek dělá CSS.
 */
export function StepsReveal({
  className,
  children,
}: {
  /** exactOptionalPropertyTypes: CSS Modules vrací string | undefined */
  className?: string | undefined;
  children: React.ReactNode;
}): React.JSX.Element {
  const ref = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduced || typeof IntersectionObserver === "undefined") {
      el.dataset.revealed = "true";
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.dataset.revealed = "true";
            observer.disconnect();
          }
        }
      },
      { threshold: 0.45 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <ol ref={ref} className={className} data-revealed="false">
      {children}
    </ol>
  );
}
