# Scénářová Playwright sada

End-to-end scénáře reálných školních situací: skutečný prohlížeč, skutečný
backend, deterministicky seedovaná testovací DB. Oddělené od legacy sady
(`playwright.config.ts`), takže zůstávají zelené a self-contained.

## Spuštění

```bash
cd client
npm run test:scenarios            # celá sada (recreate+migrate+seed → servery → testy)
SCENARIO_REUSE_DB=1 npm run test:scenarios   # rychlé lokální reruny (přeskočí recreate DB)
npm run test:scenarios -- backbone           # jen jeden scénář
```

Konfigurace: `client/playwright.scenarios.config.ts`. Vyžaduje běžící
Postgres s DB `skillstorm_test` (guard `server/scripts/db-safety.js` nepustí
nic proti jiné DB).

## Jak to funguje

1. **globalSetup** (`global-setup.ts`) — recreate + migrate + seed testovací
   DB (Prisma/psql, backend nemusí běžet), manifest zapíše na disk.
2. **webServer** — backend `:4200` (guardovaný na test DB, **throttle ON**
   kvůli rate-limit bloku) + frontend `:3001`.
3. **setup projekt** (`auth.setup.ts`) — přihlásí každou roli přes login API
   (session je cookie-based) a uloží `storageState`. Každá role má vlastní
   klientskou IP (X-Forwarded-For), aby throttling nerušil.
4. **desktop / mobile projekty** — scénáře, závislé na setupu.

## Seedovaný svět (`server/prisma/seed/scenarios-e2e.seed.ts`)

- Org „ZŠ Scénář" (ACTIVE, aktuální rok): 2.A (GRADE_2, 5 žáků → young),
  8.A (GRADE_8, 30 žáků → old), 1.SŠ (HIGH_SCHOOL_YEAR_1, 1 žák → old
  fallback), učitel obou tříd, ředitel. Katalog Matematika + téma pro
  wizard. Ready-made zadání: „Matematika 8.A" (TF+MC+FITB), „Poznávání 2.A"
  (2× MC dlaždice), „Test 1.SŠ", + krátké 20s zadání pro auto-submit.
- Org „ZŠ Druhá" — ředitel, žák, cizí zadání pro tenant testy.
- Idempotentní (wipe podle názvu, náhodná username). Manifest s účty a id
  zadání zapisuje `SCENARIO_MANIFEST=` na stdout.

Hesla: `Scenar123!`. Účty v manifestu (`.manifest.json`, gitignored).

## Bloky

| Soubor | Blok | Co ověřuje |
|---|---|---|
| `smoke.scenario.ts` | 0 | seed manifest + storageState per role |
| `backbone.scenario.ts` | 1 | učitel vytvoří test (3 typy otázek) → publish → zadá 8.A → žák odpoví (autosave přes reload) → odevzdá → učitel vidí skóre → ředitel agregát |
| `concurrency.scenario.ts` | 2 | 10 paralelních kontextů odpovídá naráz (žádná ztráta, žádná 5xx) + auto-submit po vypršení limitu |
| `age-modes.scenario.ts` | 3 | young (2.A) / old (8.A) / HS fallback z Enrollmentu, klávesy 1–4, `?mode=` mění jen prezentaci (žádný payload) |
| `security.scenario.ts` | 4 | cizí submission/test přes URL → chyba, session expiry → return-URL, login rate limit → srozumitelná 429 hláška |
| `mobile.mobile.ts` | 5 | 390px bottom tabs + dlaždice + dosažitelné odevzdání; offline uprostřed odpovídání → autosave dožene, UI informuje |

## CI

Workflow `.github/workflows/e2e-scenarios.yml` (job na každém PR): postgres
service s DB `skillstorm_test`, `npm run test:scenarios` (globalSetup migruje
+ seeduje, webServer nastartuje backend+frontend). Throttle ON, TRUST_PROXY=1.
Doba běhu lokálně ~75 s/běh; CI job s instalací deps + Playwright browser
odhadem ~5–6 min (pod 10 min → jeden job, není potřeba dělit na rychlou PR
sadu a noční). Report se uploaduje jako artefakt při selhání.

## Stabilita (proč to neflakuje)

Sada je záměrně bez retry a bez nafouknutých timeoutů. Dvě příčiny flaku byly
opraveny v kořeni:
- **globalSetup NIKDY nedropuje DB** — jen `migrate deploy` + seed (wipe je
  idempotentní). DROP by force-zavřel živá spojení backendu (Playwright
  startuje webServer souběžně) a první login by spadl na „Server has closed
  the connection".
- **Náhodné klientské IP** pro každý kontext i login (X-Forwarded-For,
  TRUST_PROXY=1). Fixní/čítačové IP kolidovaly napříč testy v 60s okně
  globálního rate-limitu (100/60s) → těžký tok backbone učitele vyčerpal
  bucket a pozdější test na téže IP dostal 429.

3× po sobě od čerstvé DB: 3/3 zelené (17 passed/běh).

## Naučené kontrakty (pro budoucí úpravy)

- Auth je **cookie-based**; tokeny se nečtou z těla. storageState per role.
- Login **scopuje org** už při plain loginu; `organizationId` v body je
  explicitní pojistka.
- Focus mode = **jedna otázka na obrazovku**, navigátor má aria-label
  „Otázka N". Odevzdání přes review dialog (`data-testid="confirm-submit"`).
- Autosave se čeká přes **responses PATCH**, ne přes textový badge.
- `/tests/:id/results` vrací `{items}`, položka má `student.name` (ne email).
- Assignment overview klíčuje na `testId`; rozjeté single-attempt zadání
  vypadne z „active" → navigovat přímo přes id z manifestu.
- Age mode se odvozuje z `session.student.grade` (ACTIVE enrollment).
- Rate-limit blok potřebuje backend s **throttle ON**.
