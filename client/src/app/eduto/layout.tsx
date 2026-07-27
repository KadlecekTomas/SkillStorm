import type { Metadata } from "next";
import { Bricolage_Grotesque, Source_Serif_4 } from "next/font/google";

/** Display — jen h1/h2. Vlastní nepravidelnost, nepůsobí jako systémový font. */
const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "800"],
  variable: "--eduto-display",
  display: "swap",
});

/** Body — patka jako v učebnici, inverze edtech defaultu (Inter/Poppins). */
const body = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  variable: "--eduto-body",
  display: "swap",
});

/**
 * POZOR PŘED SPUŠTĚNÍM: eduto.cz zatím nemá DNS záznam.
 * Drží canonical, OG url i JSON-LD — musí sedět na doménu, kam to skutečně pojede.
 */
const SITE_URL = "https://eduto.cz";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // 57 znaků
  title: "Eduto — zadání, vyplnění a vyhodnocení na jednom místě",
  // 157 znaků, benefit místo technologie
  description:
    "Učitel zadá cvičení, žák ho vyplní a vyhodnocení je hotové v tu chvíli. Nic se nepřepisuje do druhého systému a je hned vidět, kdo ve třídě potřebuje pomoct.",
  alternates: { canonical: "/eduto" },
  openGraph: {
    type: "website",
    locale: "cs_CZ",
    url: `${SITE_URL}/eduto`,
    siteName: "Eduto",
    title: "Eduto — zadání, vyplnění a vyhodnocení na jednom místě",
    description:
      "Učitel zadá cvičení, žák ho vyplní a vyhodnocení je hotové v tu chvíli. Nic se nepřepisuje do druhého systému a je hned vidět, kdo ve třídě potřebuje pomoct.",
    images: [
      {
        url: "/eduto/og.png",
        width: 1200,
        height: 630,
        alt: "Přehled školy v Edutu — odevzdání za týden, výkonnost tříd a žáci s nejnižšími průměry.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Eduto — zadání, vyplnění a vyhodnocení na jednom místě",
    description:
      "Učitel zadá cvičení, žák ho vyplní a vyhodnocení je hotové v tu chvíli. Výsledky se nikam nepřepisují.",
    images: ["/eduto/og.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Eduto",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      inLanguage: "cs",
      url: `${SITE_URL}/eduto`,
      description:
        "Webová platforma pro základní školy. Učitel zadá cvičení, žák ho vyplní a vyhodnocení je hotové v tu chvíli.",
      author: { "@type": "Person", name: "Tomáš Kadleček" },
    },
    {
      "@type": "Organization",
      name: "Eduto",
      url: SITE_URL,
      logo: `${SITE_URL}/eduto/og.png`,
    },
  ],
};

export default function EdutoLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <script
        type="application/ld+json"
        // JSON-LD je statický literál z tohoto souboru, žádný uživatelský vstup.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </div>
  );
}
