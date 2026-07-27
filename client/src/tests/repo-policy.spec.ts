import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * Repository policy — Playwright storage state se nesmí verzovat.
 *
 * Regrese: client/tests/scenarios/.auth/*.json byly tracked. Každý soubor
 * nese cookies ss_at / ss_rt / ss_csrf, tedy access a refresh token živé
 * session. Repozitář je veřejný, takže commitnutý storage state je únik
 * autentizačních údajů — i když míří na testovací prostředí.
 *
 * Soubory generuje auth.setup.ts při každém běhu (mkdirSync + storageState),
 * takže v Gitu nemají co dělat. Test čte jen názvy souborů z indexu, nikdy
 * jejich obsah — nesmí být jak selhat tak, že by vypsal token.
 */
const AUTH_DIR = "client/tests/scenarios/.auth";

/** Povolené je jen to, co adresář drží v Gitu bez tajemství. */
const ALLOWED = new Set([`${AUTH_DIR}/.gitkeep`]);

function trackedFilesIn(dir: string): string[] {
  const out = execFileSync("git", ["ls-files", `${dir}/**`, `${dir}/*`], {
    encoding: "utf8",
    cwd: process.cwd().endsWith("/client")
      ? `${process.cwd()}/..`
      : process.cwd(),
  });
  return out.split("\n").map((l) => l.trim()).filter(Boolean);
}

describe("repository policy — Playwright auth state", () => {
  it("žádný storage-state soubor není v Git indexu", () => {
    const offenders = trackedFilesIn(AUTH_DIR).filter((f) => !ALLOWED.has(f));

    // Zpráva úmyslně uvádí jen cesty, nikdy obsah.
    expect(
      offenders,
      offenders.length > 0
        ? `Playwright storage state se dostal do Gitu: ${offenders.join(", ")}. ` +
            `Spusť: git rm --cached ${offenders.join(" ")} — soubory nesou živé session cookies.`
        : "",
    ).toEqual([]);
  });

  it(".gitignore obsahuje pravidlo pro auth state", () => {
    const ignored = execFileSync("git", ["check-ignore", `${AUTH_DIR}/x.json`], {
      encoding: "utf8",
      cwd: process.cwd().endsWith("/client")
        ? `${process.cwd()}/..`
        : process.cwd(),
    }).trim();

    expect(ignored).toBe(`${AUTH_DIR}/x.json`);
  });
});
