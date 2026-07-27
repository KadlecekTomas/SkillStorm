import Image from "next/image";
import styles from "./eduto.module.css";
import { ContactLink } from "./contact-link";
import { ProductVideo } from "./product-video";
import { StepsReveal } from "./steps-reveal";

/**
 * POZOR PŘED SPUŠTĚNÍM: repozitář se na GitHubu jmenuje ještě SkillStorm,
 * tahle adresa vrací 404, dokud přejmenování neproběhne.
 */
const GITHUB_URL = "https://github.com/KadlecekTomas/Eduto";

type Funkce = {
  nadpis: string;
  text: string;
  marginalie: string;
  obrazek: string;
  alt: string;
  sirka: number;
  vyska: number;
};

const FUNKCE: Funkce[] = [
  {
    nadpis: "Sestavení testu",
    text: "Učitel poskládá test z otázek, přiřadí ho třídě a nastaví, do kdy platí.",
    marginalie: "otázky · body · termín",
    obrazek: "/eduto/05-teacher-test-builder-krok2.png",
    alt: "Průvodce tvorbou testu — přidávání otázek a nastavení bodů.",
    sirka: 1920,
    vyska: 1080,
  },
  {
    nadpis: "Vyplňování žákem",
    text: "Žák vyplňuje v prohlížeči na počítači i na telefonu. Rozepsané odpovědi se ukládají průběžně, výpadek spojení práci nesmaže.",
    marginalie: "průběžné ukládání · časovač",
    obrazek: "/eduto/03-student-test-old-casovac.png",
    alt: "Vyplňování testu žákem — časovač, přehled otázek a pole pro odpověď.",
    sirka: 1920,
    vyska: 1080,
  },
  {
    nadpis: "Vyhodnocení při odevzdání",
    text: "Uzavřené otázky se vyhodnotí ve chvíli odevzdání. Učitel vidí, co je hotové, co čeká na ruční opravu a kdo ještě neodevzdal.",
    marginalie: "vyhodnocení běží na serveru",
    obrazek: "/eduto/04-teacher-dashboard.png",
    alt: "Učitelský přehled — fronta k vyhodnocení, třídy a poslední odevzdání.",
    sirka: 1920,
    vyska: 1080,
  },
  {
    nadpis: "Bleskovka pro celou třídu",
    text: "Krátké kolo otázek, které učitel pustí všem naráz a promítne na tabuli. Odpovědi chodí z žákovských zařízení.",
    marginalie: "živé kolo · projekce",
    obrazek: "/eduto/08-bleskovka-senior.png",
    alt: "Živé kolo otázek promítnuté na tabuli s odpověďmi celé třídy.",
    sirka: 1920,
    vyska: 1080,
  },
];

const TECHNIKA = [
  {
    nadpis: "Frontend",
    text: "Next.js s App Routerem. Rozdělení podle publika řeší route groups, každá se svým řetězcem přístupových bran.",
  },
  {
    nadpis: "Backend",
    text: "NestJS nad PostgreSQL přes Prismu. Modulární členění po doménách — testy, třídy, školní roky, oprávnění.",
  },
  {
    nadpis: "Izolace dat",
    text: "Každý dotaz je vázaný na organizaci volajícího. Hranici mezi organizacemi hlídá 53 end-to-end testů, které se pokoušejí dostat k cizím datům.",
  },
  {
    nadpis: "Autentizace a role",
    text: "JWT nese organizaci a aktivní roli. Oprávnění se vyhodnocují na serveru, klient rozhoduje jen o tom, co vykreslí.",
  },
  {
    nadpis: "Audit",
    text: "Mutace prochází interceptorem, který zapíše uživatele, entitu, změněná pole, IP adresu a čas. Záznamy mají vlastní retenční pravidlo.",
  },
  {
    nadpis: "Školní rok",
    text: "Data visí na školním roce. Databázový constraint drží nejvýš jeden aktivní rok na organizaci, přechod mezi roky je řízená operace.",
  },
];

export default function EdutoPage(): React.JSX.Element {
  return (
    <div className={styles.page}>
      <main>
        {/* 01 — hero */}
        <section className={`${styles.section} ${styles.hero}`}>
          <div className={styles.shell}>
            <div className={styles.sheet}>
              <p className={styles.marginalie}>
                01
                <span>Eduto</span>
              </p>
              <div>
                <h1 className={styles.h1}>
                  Učitel zadá cvičení. Žák ho vyplní. Vyhodnocení je hotové{" "}
                  <span className={styles.mark}>v tu chvíli</span>.
                </h1>
                <p className={styles.lead}>
                  Webová platforma pro základní školy. Nikdo nepřepisuje
                  výsledky do druhého systému.
                </p>

                <div className={styles.cta}>
                  <ProductVideo />
                  <a href="#kontakt" className={styles.btnSekundar}>
                    Napsat mi
                  </a>
                </div>

                <div className={styles.heroSheet}>
                  <p className={styles.radekLabel}>Ukázka · jedna otázka</p>
                  <p className={styles.otazka}>Kolik je 7 × 8?</p>
                  <ul className={styles.dlazdice}>
                    <li>54</li>
                    <li className={styles.vybrano}>56</li>
                    <li>63</li>
                  </ul>
                  <p className={styles.ucitelskyRadek}>
                    <span>odevzdáno 14:32</span>
                    <strong>vyhodnoceno</strong>
                    <span>bez zásahu učitele</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 02 — reálný záběr */}
        <section className={styles.section}>
          <div className={styles.shell}>
            <div className={styles.sheet}>
              <p className={styles.marginalie}>
                02
                <span>Skutečná obrazovka</span>
              </p>
              <div>
                <h2 className={styles.h2}>Takhle to vypadá</h2>
                <p className={styles.p}>
                  Přehled školy — odevzdání za týden, výkonnost tříd a žáci s
                  nejnižšími průměry na jedné obrazovce.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.plnaSirka}>
            <Image
              src="/eduto/11-director-analytika.png"
              alt="Přehled školy — počty testů a odevzdání za týden, výkonnost jednotlivých tříd a seznam žáků s nejnižšími průměry."
              width={1920}
              height={1080}
              priority
              sizes="100vw"
            />
          </div>
        </section>

        {/* 03 — problém → řešení */}
        <section className={styles.section}>
          <div className={styles.shell}>
            <div className={styles.sheet}>
              <p className={styles.marginalie}>
                03
                <span>Ruční práce</span>
              </p>
              <div>
                <h2 className={styles.h2}>Co dnes zabere celé odpoledne</h2>
                <p className={styles.p}>
                  Tři kroky, které učitel dělá u každého testu znovu.
                </p>

                <StepsReveal className={styles.kroky}>
                  <li className={styles.krok}>
                    <span className={styles.krokCislo}>01</span>
                    <span className={styles.krokText}>
                      Rozdá zadání a hlídá, aby ho měli všichni.
                    </span>
                  </li>
                  <li className={styles.krok}>
                    <span className={styles.krokCislo}>02</span>
                    <span className={styles.krokText}>
                      Posbírá odevzdané práce a dohledává, kdo chybí.
                    </span>
                  </li>
                  <li className={styles.krok}>
                    <span className={styles.krokCislo}>03</span>
                    <span className={styles.krokText}>
                      Opraví každou práci zvlášť a přepíše výsledky jinam.
                    </span>
                  </li>
                  <li className={styles.zbytek}>
                    <span className={styles.krokCislo}>→</span>
                    <span>
                      Zbývá <span className={styles.mark}>jediný krok</span>:
                      podívat se, kdo potřebuje pomoct.
                    </span>
                  </li>
                </StepsReveal>
              </div>
            </div>
          </div>
        </section>

        {/* 04 — funkce */}
        <section className={styles.section}>
          <div className={styles.shell}>
            <div className={styles.sheet}>
              <p className={styles.marginalie}>
                04
                <span>Co produkt umí</span>
              </p>
              <div>
                <h2 className={styles.h2}>Čtyři obrazovky, jedna smyčka</h2>

                {FUNKCE.map((funkce, index) => (
                  <article
                    key={funkce.nadpis}
                    className={`${styles.funkce} ${
                      index % 2 === 1 ? styles.obracene : ""
                    }`}
                  >
                    <div className={styles.funkceText}>
                      <h3 className={styles.h3}>{funkce.nadpis}</h3>
                      <p className={styles.p}>{funkce.text}</p>
                      <p className={styles.popisek}>{funkce.marginalie}</p>
                    </div>
                    <div className={styles.shotRam}>
                      <Image
                        src={funkce.obrazek}
                        alt={funkce.alt}
                        width={funkce.sirka}
                        height={funkce.vyska}
                        loading="lazy"
                        sizes="(min-width: 64rem) 34rem, 100vw"
                      />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 05 — Kde jsme. Text je vyměnitelný bez zásahu do layoutu. */}
        <section className={styles.section}>
          <div className={styles.shell}>
            <div className={styles.sheet}>
              <p className={styles.marginalie}>
                05
                <span>Stav</span>
              </p>
              <div>
                <h2 className={styles.h2}>Kde jsme</h2>
                <p className={styles.lead}>
                  První škola s Edutem učí. Kapacitu pro další piloty otevíráme
                  postupně — chceme, aby každá dostala pozornost.
                </p>

                <ul className={styles.pilire}>
                  <li className={styles.pilir}>
                    <p className={styles.pilirText}>
                      Data vaší školy zůstávají vaše. Žádná jiná škola se k nim
                      nedostane — oddělení je vynucené v celém systému, ne jen v
                      nastavení.
                    </p>
                    <p className={styles.pilirDukaz}>
                      53 e2e testů hlídá hranici mezi organizacemi
                    </p>
                  </li>
                  <li className={styles.pilir}>
                    <p className={styles.pilirText}>
                      Uvidíte, kdo co změnil. Když se výsledek žáka upraví, je
                      dohledatelné kdy a kým.
                    </p>
                    <p className={styles.pilirDukaz}>
                      audit log — uživatel, entita, změněná pole, IP, čas
                    </p>
                  </li>
                  <li className={styles.pilir}>
                    <p className={styles.pilirText}>
                      Nemusíte nám věřit na slovo. Kód i plán vývoje jsou
                      veřejné, včetně toho, co zatím neumíme.
                    </p>
                    <p className={styles.pilirDukaz}>
                      veřejný repozitář, verzovaná roadmapa
                    </p>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 06 — technické pozadí */}
        <section className={`${styles.section} ${styles.dark}`}>
          <div className={styles.shell}>
            <div className={styles.sheet}>
              <p className={styles.marginalie}>
                06
                <span>Pod kapotou</span>
              </p>
              <div>
                <h2 className={styles.h2}>Jak je to postavené</h2>
                <p className={styles.p}>
                  Jedna kódová základna, dvě aplikace: Next.js klient a NestJS
                  API nad PostgreSQL.
                </p>

                <div className={styles.techMrizka}>
                  {TECHNIKA.map((polozka) => (
                    <div key={polozka.nadpis} className={styles.techPolozka}>
                      <h3>{polozka.nadpis}</h3>
                      <p>{polozka.text}</p>
                    </div>
                  ))}
                </div>

                <div className={styles.odkazy}>
                  <a
                    className={styles.odkaz}
                    href={GITHUB_URL}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Kód na GitHubu →
                  </a>
                  <a
                    className={styles.odkaz}
                    href={`${GITHUB_URL}/tree/main/docs/roadmap`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Roadmapa →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 07 — autor a kontakt */}
        <section
          id="kontakt"
          className={`${styles.section} ${styles.dark}`}
        >
          <div className={styles.shell}>
            <div className={styles.sheet}>
              <p className={styles.marginalie}>
                07
                <span>Kontakt</span>
              </p>
              <div className={styles.autor}>
                <h2 className={styles.h2}>Kdo za tím stojí</h2>
                <p className={styles.p}>
                  Tomáš Kadleček. Eduto stavím sám — návrh rozhraní, frontend,
                  API i datový model.
                </p>
                <p className={styles.p}>
                  Pokud vás zajímá pilot ve vaší škole nebo se chcete zeptat na
                  technické řešení, napište mi.
                </p>
                <div className={styles.odkazy}>
                  <ContactLink className={styles.odkaz} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.paticka}>
        <div className={styles.shell}>Eduto · 2026</div>
      </footer>
    </div>
  );
}
