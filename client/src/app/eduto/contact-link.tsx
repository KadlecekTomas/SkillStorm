"use client";

import { useEffect, useState } from "react";

/**
 * Kontakt bez plain-text adresy ve zdroji.
 *
 * Proč ne formulář: formulář znamená endpoint, ukládání zpráv, ochranu proti
 * spamu a další věc, která může na produkci tiše selhat. Na portfolio stránce
 * s jedním příjemcem je to nepoměr — mailto funguje vždy a nemá provozní část.
 *
 * Adresa se skládá až v prohlížeči, takže v HTML odpovědi žádná není.
 * Bez JS zůstane čitelný zápis, který člověk přepíše a scraper běžně nesebere.
 */
const USER = "kadle.tom";
const DOMAIN = "gmail.com";

export function ContactLink({
  className,
}: {
  className?: string | undefined;
}): React.JSX.Element {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    setAddress(`${USER}@${DOMAIN}`);
  }, []);

  if (address === null) {
    // Server render i stav bez JS — adresa čitelná, ale ne strojově sebratelná.
    return (
      <span className={className}>
        {USER} <span aria-hidden="true">[zavináč]</span>
        <span className="sr-only">@</span> {DOMAIN}
      </span>
    );
  }

  return (
    <a className={className} href={`mailto:${address}`}>
      {address} →
    </a>
  );
}
