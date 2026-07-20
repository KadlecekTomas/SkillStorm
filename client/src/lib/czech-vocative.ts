/**
 * Jednoduchý český vokativ pro křestní jména v pozdravech ("Ahoj, Kubo!").
 *
 * Záměrně pokrývá jen bezpečná, vysoce frekventovaná pravidla. U čehokoli
 * nejistého vrací jméno beze změny — špatně vyskloňované jméno je horší než
 * nominativ. Žádný slovník, žádná detekce rodu; pravidla jsou volena tak,
 * aby fungovala pro běžná česká jména i domácké podoby (Anička, Kuba, Terezka).
 */

/** Koncovky, po kterých se tvrdé -r skloňuje "-ře" (Petr → Petře). */
const CONSONANTS = "bcčdďfghjklmnňpqrřsštťvwxzž";

/** Běžná nesklonná (vesměs ženská) jména končící souhláskou — nechat být. */
const INDECLINABLE = new Set([
  "karin",
  "ester",
  "ingrid",
  "dagmar",
  "miriam",
  "ruth",
  "doris",
  "iris",
  "carmen",
  "agnes",
  "nikol",
]);

function isConsonant(ch: string | undefined): boolean {
  return !!ch && CONSONANTS.includes(ch.toLowerCase());
}

/** Vokativ jednoho křestního jména; fallback = beze změny. */
export function vocative(firstName: string): string {
  const name = firstName.trim();
  if (name.length < 3) return name;
  const lower = name.toLowerCase();
  if (INDECLINABLE.has(lower)) return name;

  // -a → -o: Anička → Aničko, Kuba → Kubo, Jana → Jano
  if (lower.endsWith("a")) return `${name.slice(0, -1)}o`;

  // -ek → -ku: Radek → Radku, Marek → Marku (pohyblivé -e- neřešíme, je vzácné u jmen s ním)
  if (lower.endsWith("ek")) return `${name.slice(0, -2)}ku`;

  // -k po samohlásce → -ku: Kubík → Kubíku
  if (lower.endsWith("k") && !isConsonant(lower.at(-2))) return `${name}u`;

  // měkké souhlásky → +i: Ondřej → Ondřeji, Tomáš → Tomáši, Lukáš → Lukáši
  if (/[jšžčřťďň]$/.test(lower)) return `${name}i`;

  // -r po souhlásce → -ře: Petr → Petře
  if (lower.endsWith("r") && isConsonant(lower.at(-2))) return `${name.slice(0, -1)}ře`;

  // tvrdé/obojetné souhlásky → +e: Šimon → Šimone, Adam → Adame, Filip → Filipe,
  // Jakub → Jakube, David → Davide, Martin → Martine
  if (/[nmtdbvpsz]$/.test(lower)) return `${name}e`;

  // Vše ostatní (samohláskové konce: Jiří, Ondře, Hugo, Lucie…) beze změny.
  return name;
}
