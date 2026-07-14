# Audit `findMany` bez limitu (BLOK 4, 2026-07-14)

Prošel jsem všech 85 výskytů `findMany` bez `take` v `server/src`. Hlavní
list endpointy (`/tests`, `/students`, `/teachers`, `/users`, `/memberships`)
paginují už dávno (`page`/`limit` + cap). Zbytek se dělí do tří kategorií.

Měření na seedu 500 žáků / 2 400 submissions / 20 tříd / 40 testů:
`GET /dashboards/director` **78 ms cold / 7 ms warm** (cache 60 s), payload
8,5 KB (agregáty, ne celé tabulky) — kritérium < 2 s splněno ~25×.

## A) Doplněn `take` cap (rostou s provozem) — 18 dotazů

| Místo | Dotaz | Cap |
|---|---|---|
| assignments.service:675/684 | zadání žáka (class + direct) | 1 000 |
| assignments.service:708 | submissions žáka k zadáním | 2 000 |
| assignments.service:958 | id-only visibility scope celé org | 10 000 |
| tests.service:1240 | assignments jednoho testu (grades in use) | 1 000 |
| stats.service:205 | distinct testId v submissions | 5 000 |
| stats.service:482 | třídy školního roku (dashboard) | 500 |
| stats.service:507 | učitelé org (dashboard) | 1 000 |
| stats.service:629 | submissions tohoto týdne (aktivita) | 2 000 (`DASHBOARD_SUBMISSION_LIMIT`) |
| support.service:311 | platformní triage tiketů | 500 |
| org-subject.service:132 | předměty org | 500 |
| class-sections.service:180 | předměty třídy | 500 |
| class-sections.service:1677 | třídy učitele v roce | 500 |
| enrollments.service:506 | roster třídy | 500 |
| teacher-access.service:290 | vazby učitel–třída | 500 |
| analytics.service ×5 | responses/submissions okna analytiky | 20 000 |
| student-diagnostic.service:262 | responses diagnostiky žáka | 20 000 |

Kapy jsou pojistky („safety cap" komentář u každého) — reálné datové objemy
jsou o řád níž; při překročení se ořízne výpočet, nespadne pod-dotaz.
Dashboard submissions už cap měl (`DASHBOARD_SUBMISSION_LIMIT = 2000`).

## B) Přirozeně ohraničené rodičem — bez zásahu (~55 dotazů)

Otázky jednoho testu, responses jedné submission, enrollmenty jednoho žáka
v roce, roky jedné org, membershipy jednoho uživatele, badge/achievementy
jednoho membershipu, `{ in: ids }` dotazy ohraničené vstupem volajícího,
TeacherSubject/SubjectLevel/TopicLevel kurikula, catalog* číselníky
(desítky řádků), refresh token podle hashe.

## C) Záměrně bez limitu — kompletnost je požadavek (~12 dotazů)

- `privacy.service` — GDPR export/anonymizace MUSÍ být úplné.
- `academic-year-rollover` + `promotion.service` — celoorgové dávkové joby.
- `platform/catalog-sync` — synchronizace celého katalogu (platform job).
- `rbac-default-sync` — katalog permissions.
- `testing.controller` — e2e support endpoint (jen test build).
- `imports.service` — ohraničeno velikostí importního souboru.
