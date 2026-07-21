# Copy & UI Audit — Inventura (Část 1)

Datum: 21. 7. 2026 · Branch: `chore/copy-and-ui-audit` · Stav: **inventura, nic nezměněno**

Metoda: statická analýza všech `page.tsx` + komponent, ověření každého handleru (API call / router.push / no-op) a existence cílových rout grepem. „PRIMARY" = zelené tactile tlačítko (`Button` default varianta, `bg-accent` + `shadow-tactile`).

Verdikty: `[OK]` `[DEAD-BUG]` (má fungovat, je rozbité — jde do bug listu, v auditu se neopravuje) `[DEAD-PROMISE]` (feature neexistuje — default smazat + zapsat do removed-promises.md) `[DUPLICATE]` `[JARGON]` `[UNCLEAR]` `[MISPLACED]`.

Slovník, který se NEpřejmenovává: Bleskovka, Výprava, Mise, parťák, Rodinný prostor.

---

## 0. Průřezové nálezy (nejdůležitější)

### 0.1 Navigace je jeden plochý seznam bez filtrování rolí — [MISPLACED] systémové
`client/src/config/dashboard-navigation.tsx` (jediný zdroj pro `sidebar.tsx` i `bottom-tabs.tsx`) má 6 položek: Přehled, Třídy, Testy, Knihovna, Výsledky, Nastavení. Renderují se **všem rolím bez filtru**:
- **Žák** vidí Třídy (učitelská správa tříd), Knihovnu, Výsledky (učitelská diagnostika, ne jeho výsledky). *(Korekce z ověření: tab Testy pro žáka funguje — má vlastní větev „Přiřazené testy", viz §2.)*
- **Ředitel/OWNER** naopak v navigaci NEMÁ: Analytiku, Audit log, Školní roky, Podporu, Správu učitelů.

### 0.2 Nedosažitelné obrazovky — [DEAD-BUG]
Nulové interní odkazy (ověřeno grepem všech `Link`/`push`):
| Routa | Poznámka |
|---|---|
| `/app/audit` | audit log ředitele — jen ručně přes URL |
| `/app/analytics` (+ redirect) | nikam nevede odkaz |
| `/app/analytics/class-heatmap` | navíc má v UI eyebrow **„Sprint 3"** (interní marker v produkci) a anglický titulek „Class heatmap" |
| `/app/analytics/student-timeline` | nedosažitelná |
| `/app/academic-years` | jediný odkaz je uvnitř `AssignToClassModal.tsx:280` — [MISPLACED] |
| `/app/support` | dostupná jen ze success panelu po nahlášení chyby |
| `/app/student/analytics` | žádný vstup z žákovského dashboardu ani navigace; stránka nemá vlastní nadpis |

### 0.3 Surové enum hodnoty zobrazené uživatelům — [JARGON] systémové
| Kde | Co uživatel vidí |
|---|---|
| `students/[studentId]/page.tsx:82-93` `DiagnosticBadge` | **WEAK / WARNING / GOOD / INSUFFICIENT_DATA** (mapa mapuje enum sám na sebe) |
| `results/[submissionId]/page.tsx:111` (žák) | **PENDING / APPROVED / REJECTED** |
| `tests/[testId]/results/page.tsx:75-84` | `Stav: {r.status}` raw + anglické „Score:", „Attempt:", „Submitted:", „n/a" |
| `tests/[testId]/page.tsx:984` + `edit/page.tsx:312` | typ otázky raw: **TRUE_FALSE, MULTIPLE_CHOICE, FILL_IN_THE_BLANK…** |
| `sidebar.tsx:142`, `dashboard-header.tsx:107,137`, `select-organization:46`, `join:335` | role anglicky: „teacher", „director", „student"… — přitom česká mapa `ROLE_LABELS` (Vlastník/Ředitel/Učitel/Žák/Rodič) existuje v `dashboard-header.tsx:17` a používá ji jediné místo |
| `(school)/app/support/page.tsx:92,104` | tiketové **RESOLVED / IN_REVIEW / OPEN**, **SUBJECT**, **HIGH** — žádná mapa |
| auth-form, NoOrganizationScreen | „Role po vytvoření organizace: **OWNER**" |
| platform organizations/users | PENDING/ACTIVE/SUSPENDED, SUPERADMIN/DEVOPS/SUPPORT (vedle českých filtrů) |

### 0.4 Anglické věty/labely v české aplikaci — [JARGON]
- `(auth)/join/page.tsx:273` — „Your role will be assigned automatically based on the invitation."
- `forms/auth-form.tsx:269` — „Registration is invite-only. Use your organization invite link."
- auth-form taby **„Create org" / „Join org"**, label „Invite token", „ownerem", „invite tokenu", placeholdery „Jane Cooper", „you@school.edu"
- Nastavení: nadpis **„Notifications & GDPR"**, „Weekly analytics digest", „GDPR data export reminders", karta **„Invite members"**, „Invite code/link", „Copy", success alert **„Settings updated / All changes synced with SkillStorm backend."** (navíc lež — viz 4.1)
- Správa učitelů: sloupce „Name/Email/Role/Created", „No teachers yet", „Total teachers: N", „scoped access"
- Třídy: badge **„Read-only"**, tab **„Invite link"**, „Invite kód/odkaz"
- `ReportIssueButton` s viditelnými labely „Report assignment problem", „Report issue with classroom subjects", „Report issue with subjects"
- LevelUpModal: „Level up!"/„Level {n}" vs. český „Úroveň" na dashboardu
- Žákovský stub: „Chybí assignmentId", tlačítko „Přejít na assignments"
- Dev-speak v chybách: „nepodařilo se přepnout kontext organizace", `topicLevelId` v backticku v Nastavení, „parametr \`classId\`" v učitelské analytice

### 0.5 Tři cesty připojení pozvánkou — [DUPLICATE] systémové, s bezpečnostním rizikem (mini-audit schválen 21. 7. 2026)

Obě API rodiny (`/invites/*` i `/invitations/*`) jsou fasády nad **jednou** `InvitesService`, která řeší token i 6znakový kód jednotně (`OR: [{token},{code}]`, `invites.service.ts:362,429`). Duplicita je technický dluh, ne záměr ani bug.

**Kanonické rozhodnutí:**
- Veřejný join flow = stránka **`/join`** + `GET /invitations/preview` + `POST /invitations/accept` (novější fasáda, striktní DTO, `@Throttle 10/60 s`, v kódu označená „production join flow").
- `POST /invites` (vytváření pozvánek řediteli/učiteli) **zůstává** — jiná doména.
- `GET /invites/preview` a `POST /invites/accept` = **deprecated technický dluh**.

**Nálezy:**
1. **Rozdílná/neověřená ochrana endpointů:** deprecated endpointy `GET /invites/preview` a `POST /invites/accept` nemají controller-level `@Throttle`, který kanonická `/invitations/*` má (přidán security fixem `f519d60`). Zda servisní vrstva obsahuje ekvivalentní vlastní ochranu proti hádání kódů, nebylo ověřeno — ochrana obou cest je tedy prokazatelně rozdílná na úrovni controlleru a na úrovni service neověřená. [→ tech-debt/bug list]
2. `NoOrganizationScreen` (join modal) používá nekanonickou cestu `/invites/*`. [DUPLICATE]
3. Register tab „Join org" je třetí, duplicitní join flow v registračním formuláři. [DUPLICATE]
4. **Cílový stav: jedna UX cesta přes `/join`** — NoOrganizationScreen odkazuje na `/join` místo vlastního modalu; register tab zmizí (auth-intent v sessionStorage už dnes vrací nepřihlášeného uživatele po registraci zpět na `/join`).

### 0.6 Žádná centralizace stringů
Neexistuje i18n/strings modul; jediná centralizace je `utils/toast.ts` (HTTP chyby, dobře udělané, ale pouští backend `message` doslovně). Duplicitní clustery: role labely (1 mapa, 5 míst ji obchází), „Smazat" 8× vs „Odstranit" 1×, ≥3 varianty empty state „žádné testy/zadání", loading „Načítám data" vs „Načítám data…". `app-error-boundary.tsx` a `classrooms-page.tsx:1219` zobrazují raw `error.message`.

---

## 1. Auth + onboarding — ✅ OVĚŘENO (21. 7. 2026, přímá kontrola všech souborů oblasti)

Ověřené soubory: `(auth)/login|register|join|reset-password[/token]/page.tsx`, `(auth)/layout.tsx`, `forms/auth-form.tsx`, `onboarding/{CreateOrganization,AcademicYear,PendingOrganization}OnboardingScreen.tsx`, `onboarding/setup/page.tsx`, `NoOrganizationScreen.tsx`, `select-organization/page.tsx`, `organization-suspended/page.tsx`, `(public)/page.tsx`, `account/security/page.tsx`. Všechny handlery reálné (API/router), žádný no-op. Draft potvrzen beze změn verdiktů; doplněn 1 nový nález (viz Public homepage).

### Login `(auth)/login` + `auth-form.tsx` + `(auth)/layout.tsx`
- Tlačítko „Přihlásit se" (primary, POST /auth/login) [OK]. PRIMARY: 1.
- Placeholder „you@school.edu" [JARGON]. Success toast „Přihlašuji…" [UNCLEAR] (tonálně divné).
- Sidebar layoutu: ghost „Vytvořit účet nebo se připojit ke škole" → /register — [DUPLICATE] s in-form odkazem „Zaregistrujte se" hned vedle.
- Ostatní texty (validace, 401/429 hlášky, odkazy) [OK].

### Register `(auth)/register`
- „Vytvořit účet" (primary, POST /auth/register) [OK]. PRIMARY: 1.
- Taby „Create org"/„Join org", „ownerem", „invite tokenu", „Invite token je povinný.", „Registration is invite-only…", „Jane Cooper", „Role po vytvoření organizace: OWNER" — vše [JARGON] (viz 0.3/0.4).
- Chyba jména na `auth-form.tsx:285` renderovaná bez stylu (sourozenci mají `text-sm text-red-600`) — [DEAD-BUG] (kosmetický).
- Celý JOIN_ORG tab je třetí plocha pro „připojit se pozvánkou" vedle `/join` a NoOrganizationScreen — [DUPLICATE].

### Join `(auth)/join`
- Kroky kód → náhled → přijmout; API `/invitations/*` (token) ověřeno [OK]. PRIMARY: max 1 najednou.
- Label „Kód nebo token pozvánky" [JARGON]; anglická věta na ř. 273 [JARGON]; „Budeš přidán jako {role.toLowerCase()}" — raw enum [UNCLEAR/JARGON].
- Ostatní copy (chybové stavy, náhled org/třída/rok) [OK].

### Reset hesla (obě stránky)
- Vše [OK] — česky, anti-enumeration hláška, 1 primary. Nejčistší obrazovky auditu.

### Onboarding: Create Organization / Academic Year / Pending / Setup
- Všechny 4 obrazovky: 1 primary, funkční API, dobré texty — převážně [OK].
- „nepodařilo se přepnout kontext organizace" [JARGON]; „server nevrátil ID" [UNCLEAR]; eyebrow „Onboarding školy" [JARGON].
- Typy organizace „Komunita"/„Soukromá" disabled s „Již brzy" — [OK] (poctivé připravujeme, vzor pro ostatní).
- Setup „Vytvořit první třídu" → vede na seznam tříd, ne na otevřený create dialog — [UNCLEAR] mírné.

### NoOrganizationScreen `(school)/app/onboarding`
- Funkčně OK, ale **[DUPLICATE]**: modálně duplikuje `/onboarding/create-organization` i `/join` — a join používá **jiné API** (`/invites` kód) než `/join` (`/invitations` token). Riziko rozjetí chování.
- „Získáš roli OWNER" [JARGON]; „vyber svou roli" odporuje auto-přiřazení role [UNCLEAR].

### Select organization `/select-organization`
- „Použít" (primary, POST switch-organization) [OK] — ale **N zelených primary** (jedno na členství) [FLAG >1 PRIMARY].
- „Role: {role}" raw uppercase + badge s toutéž rolí = 2× role na řádek [JARGON]+[DUPLICATE]; fallback názvu org = raw UUID [UNCLEAR]; „dashboardu" [JARGON mírné].

### Organization suspended
- Slepá ulička: copy říká „kontaktujte podporu", ale žádná akce/odkaz neexistuje — [DEAD-PROMISE mírné]. PRIMARY: 0.

### Public homepage `(public)`
- **„Vyzkoušet demo"** (hero primary, ř. 66) → `/register` — demo neexistuje — **[DEAD-PROMISE]**.
- **„Náhled aplikace"** (ř. 132) — šedý placeholder box místo screenshotu — **[DEAD-PROMISE]**.
- **NOVÉ:** feature karta „Přehled výsledků" (ř. 23) slibuje **„Export do PDF pro archivaci a hodnocení"** — PDF export v aplikaci neexistuje (tlačítko je věčně disabled, viz §2) — **[DEAD-PROMISE]** marketing slibuje neexistující funkci.
- 3× CTA na /register na jedné stránce [DUPLICATE]. Ostatní marketingové texty [OK].

### Account security `/account/security`
- „Změnit heslo" (primary, POST change-password) [OK] — pozn.: toto je FUNKČNÍ změna hesla, na rozdíl od té v Nastavení (4.1).
- Podtitulek slibuje „nastavení účtu", stránka umí jen heslo [UNCLEAR]; chybový fallback zobrazuje raw `err.message` [UNCLEAR].

---

## 2. Žák (young/old) — ✅ OVĚŘENO (21. 7. 2026, přímá kontrola souborů; korekce draftu označeny „KOREKCE")

### Žákovský dashboard `(school)/app` → `StudentDashboard.tsx`
- Role dispatch v `page.tsx` v pořádku; fallback „Přehled není k dispozici." (ř. 41) bez akce [UNCLEAR mírné].
- „Čeká na tebe" karty → `/app/assignments/{id}` (ř. 188) [OK]. Hero (XP, úroveň, streak, parťák) [OK]. BadgesPanel má vzorový empty state s dalším krokem [OK].
- **„Hotovo" karty nejsou klikací** (ř. 208-222 — čistá `Card` bez `Link`) — z dashboardu neexistuje cesta na výsledek odevzdaného testu, přestože `/app/results/{submissionId}` existuje — **[UNCLEAR/DEAD-PROMISE]**.
- Empty state odevzdaných: „Zatím nemáš žádné odevzdané testy." (ř. 22) — bez dalšího kroku [FLAG].
- PRIMARY: 0 [OK].

### Stub `student/tests/[testId]`
- **[DEAD-BUG]** ř. 19: `router.replace('/assignments/${assignmentId}')` — chybí prefix `/app` → **404** (top-level `/assignments` routa neexistuje, ověřeno proti mapě rout).
- Bez parametru: „Chybí assignmentId" (ř. 29) + tlačítko „Přejít na assignments" (ř. 33) [JARGON].

### Moje zadání `/app/assignments` (seznam) + launcher `/app/assignments/[assignmentId]`
- Seznam: „Otevřít test"/„Zobrazit výsledek" (primary per řádek, pro žáka aktivní) [OK]; empty state žáka „Nemáš žádná aktivní zadání." — bez dalšího kroku, ale neškodné [FLAG mírné].
- **NOVÉ [DEAD-BUG]** `assignments/page.tsx:33`: fallback `/app/results/${submissionId ?? a.id}` — když `submissionId` je null a `attemptsUsed > 0`, pošle **ID zadání** do routy pro odevzdání → results stránka volá `/submissions/{assignmentId}` → „Výsledek nebyl nalezen."
- Launcher: „Spustit test" (primary) + „Otevřít v testovacím režimu (nová záložka)" (outline); stavy upcoming/closed/exhausted česky a jasně; hotové odevzdání přesměruje na výsledek [OK]. PRIMARY: 1 [OK].

### Testy `/app/tests` — **KOREKCE draftu**
- Draft tvrdil, že žáka guard zablokuje (mrtvý tab). **Nesprávně**: STUDENT má `VIEW_OWN_ASSIGNMENTS` (`types/permissions.ts`), guardem projde a stránka má plnohodnotnou žákovskou větev: „Přiřazené testy" + „Testy přiřazené tobě nebo tvé třídě." (ř. 352-358), klik na řádek → výsledek/detail (`studentAssignmentTargetHref`, ř. 59 — korektní, bez fallback bugu).
- Žákovský empty state je vzorový: „Zatím ti nebyl přiřazen žádný test. Kontaktuj svého učitele." (ř. 445-448) [OK].
- Tab „Testy" pro žáka tedy **[OK]**, ne [DEAD-BUG]. Duplicita se seznamem „Moje zadání" (dva seznamy téhož pro žáka: /app/tests a /app/assignments) — [DUPLICATE] k rozhodnutí.

### Vyplňování testu (focus) — `(focus)/app/assignments/[assignmentId]/test` + `components/student-answering/*`
- Spot-verifikováno: „Zkontrolovat a odevzdat" (status bar, default label), review dialog „Odevzdat test"/„Zpět do testu", redirecty na `/app/results/{id}` se správným prefixem (ř. 68, 84). Flow [OK] a jazykově vzorové — nejlepší část aplikace. PRIMARY: 1 najednou [OK].

### Výsledek pokusu `results/[submissionId]` (guard STUDENT-only, ověřeno)
- Texty a struktura [OK], ale ř. 111 raw **{submission.status}** → „PENDING/APPROVED/REJECTED" [JARGON] — nekonzistentní s lokalizovaným „správně/špatně/čeká na vyhodnocení" (ř. 138) na téže stránce.
- Chybový fallback zobrazuje raw `e.message` (ř. 59) [UNCLEAR].

### `/app/results` (žák se sem dostane tabem „Výsledky"; guard `withGuard()` bez omezení — ověřeno ř. 438)
- Učitelská „Diagnostika výsledků" — pro žáka [MISPLACED] (viz 0.1). Navíc `roleHome` mapa (`types/permissions.ts:75-76`) posílá STUDENT i PARENT po odmítnutí přístupu (`with-permission.tsx:27`) právě sem — bounce target rolí je učitelská diagnostika [MISPLACED].
- **KOREKCE draftu — „Export PDF":** dvě empty-state větve jsou `disabled` (ř. 314, 338), ale hlavní větev (ř. 390-399) je **aktivní** (disabled jen bez organizace), s tooltipem „Export do PDF" a **bez jakéhokoli onClick** — klikací tlačítko, které nic neudělá. **[DEAD-PROMISE]** (horší forma než v draftu).
- Mock data na učitelské straně: syntetický `trendData` (ř. 216-226), `trendPercent` hardcoded, `mistakeCount` u všech témat = celkový počet chyb třídy (ř. 178) — [DEAD-BUG] (bug list).
- Empty state formulovaný pro učitele („Po vytvoření úkolů…") — pro žáka matoucí [FLAG].

### Žákovská analytika `student/analytics` (guard `VIEW_RESULTS`, ověřeno)
- Tabulky přeložené [OK]; stránka nemá vlastní nadpis, nevede na ni žádný odkaz (0.2) a empty states neříkají, jak data vzniknou [FLAG].
- **NOVÉ [UNCLEAR]** ř. 40-43: `catch` polyká chyby API do prázdných polí — výpadek serveru vypadá jako „nemáš žádná data"; loading state se nikdy nezobrazí (`[, setLoading]`, ř. 23).

### Kampaňový a live board (focus)
- Guard `TEACHER/DIRECTOR/OWNER` — žák se na ně nedostane [OK] (projekce). Žádný žákovský pohled na Výpravu/Misi neexistuje — pokud byl slibován, [DEAD-PROMISE] (k rozhodnutí).

### Chrome pro žáka (ověřeno: `dashboard-navigation.tsx`, `app-header.tsx`, `dashboard-header.tsx`, `sidebar.tsx`)
- Navigace bez filtru rolí (0.1) — pro žáka reálně: Třídy (guard jen `requireSchoolWorkspace` → učitelská správa tříd) [MISPLACED], Knihovna (`withGuard()` bez omezení) [MISPLACED], Výsledky (učitelská diagnostika) [MISPLACED]; Testy [OK — viz korekce], Nastavení [UNCLEAR].
- Badge role „student" anglicky: `dashboard-header.tsx:~136` (fallback badge), org-switcher suffix `(student)` (ř. ~107), `sidebar.tsx:~142` [JARGON] — česká `ROLE_LABELS` mapa přitom existuje o pár řádků výš.
- **Zvoneček `app-header.tsx:30-32` bez handleru** — dekorace slibující notifikace [DEAD-PROMISE].
- „Vytvořit" korektně skryté za `PermissionGate CREATE_TEST` [OK].
- LevelUpModal: „Level up!" (ř. 28) a „Level {n}" (ř. 31) anglicky vs. český „Úroveň" na dashboardu [JARGON].

---

## 3. Učitel

### Učitelský dashboard — `TeacherCommandCenter`
- Bleskovka banner „Spustit" → setup dialog [OK]; „Přejít na vyhodnocení →", „Zobrazit třídu →", řádky žáků/tříd — vše funkční [OK]. Empty states v pořádku. PRIMARY: efektivně 1 [OK].

### Bleskovka setup + Live board
- Kompletně funkční, slovník konzistentní (Výprava/Mise/parťák), 1 dominantní akce v každém kroku [OK].

### Seznam testů `/app/tests`
- **[DEAD-BUG]** `handlePublish` (ř. 290-302) a `handleArchive` (ř. 304-316) mají try/finally **bez catch** — neúspěšné publikování/archivace ze seznamu **tiše zmizí** (žádný toast, stav se nezmění). Publish ze seznamu navíc obchází kontrolu připravenosti, kterou detail vynucuje.
- „+ Vytvořit test" je tmavě slate, ne zelený accent — nekonzistentní vizuální jazyk primárních akcí [UNCLEAR/design].
- Publikovat/Přiřadit/Archivovat dostupné v seznamu i detailu — [DUPLICATE] přijatelné (kontext seznam vs. detail), k rozhodnutí.
- Sekce „Koncepty/Publikované/Archiv" přeložené [OK]; empty state s dalším krokem [OK].

### Vytvoření testu `/app/tests/create`
- [OK] — 1 primary, česká validace. Info „Nejsou vytvořeny žádné předměty" bez odkazu do Nastavení [UNCLEAR mírné].

### Detail testu `/app/tests/[testId]`
- Publish s checklistem a scroll-to-problem — vzorové [OK].
- Typ otázky raw enum (ř. 984) [JARGON].
- ~250 řádků mrtvého kódu za `canInlineEdit = false` (ř. 728) + zapomenutý `console.log` (ř. 256) — technický dluh (bug list).
- Primární akce tu jsou `bg-slate-900`, jinde zelené [design].

### Editace testu `/edit`
- [OK] — 1 primary „Uložit změny", zámek po odevzdáních srozumitelný. Raw enum typu otázky (ř. 312) [JARGON].

### AssignToClassModal
- Funkčně [OK], 1 primary. „Report assignment problem" anglicky [JARGON]; „mimo allowedGrades (5. třída)" — název pole ze zdrojáku v UI (ř. 341) [JARGON].

### Výsledky testu `/results`
- Raw `r.status` + „Score:/Attempt:/Submitted:/n/a" [JARGON] (0.3). Bez akcí; empty state bez vodítka [FLAG mírné].

### `/app/assignments` (učitel)
- Učitel sem může, ale je to osobní žákovský seznam — vždy prázdný, tlačítka disabled s tooltipem — [MISPLACED/UNCLEAR] bez vysvětlení.

### Legacy stub `tests/[testId]/submission`
- Záměrná slepá ulička „Zastaralá cesta" (guard STUDENT); „Přejít na assignments" [JARGON]. Kandidát na smazání.

### Knihovna `/app/library`
- Filtry funkční [OK]; jen prohlížení, žádné CTA pro přidání materiálu; empty state deleguje na child bez vlastní hlášky [UNCLEAR mírné].

### Třídy `classrooms-page.tsx`
- Rozsáhlé, převážně funkční a česky [OK]. Nálezy:
  - Add-students modal: aktivní tab (zelený default) + zelené „Zapsat" = **2 zelené primary najednou** [FLAG].
  - Tab „Invite link", „Invite kód", „Invite odkaz" [JARGON]; badge „Read-only" [JARGON].
  - **Chybí odebrání žáka ze třídy** — 4 cesty jak přidat, žádná jak odebrat [DEAD-PROMISE/gap, k rozhodnutí].
  - „Vytvořit předmět" ve skutečnosti jen přesměruje do Nastavení [UNCLEAR mírné].
  - „Požádat správce o vytvoření školního roku" — zelené primary, které jen vyhodí toast [MISPLACED].
  - Logika zakládání školního roku zduplikovaná s `/app/academic-years` [DUPLICATE].
- „Invite link je nejjednodušší cesta pro rodiče." — odkazuje na rodičovskou plochu, která neexistuje [DEAD-PROMISE-adjacent].

### Učitelská analytika `/app/teacher/analytics`
- Vyžaduje `?classId=`, ale **neexistuje výběr třídy ani žádný odkaz, který by param předal**; empty state radí zadat „parametr `classId`" — **[DEAD-PROMISE-adjacent + JARGON]**.

### Detail žáka `/app/students/[studentId]`
- Pěkně přeložené, kromě `DiagnosticBadge` s raw WEAK/WARNING/GOOD/INSUFFICIENT_DATA (0.3) [JARGON]. PRIMARY: 0 [OK].

---

## 4. Ředitel / OWNER

### 4.1 Nastavení `/app/settings` — nejhorší obrazovka auditu
- **[DEAD-BUG]** „Uložit profil" (primary): handler jen `setSubmitted(true)`, **žádné API**; formulář předvyplněný hardcoded personou **„Alex Novak" / alex@skillstorm.dev**.
- **[DEAD-BUG]** „Změnit heslo" (primary): stejný no-op — uživatel věří, že si změnil heslo, a nezměnil. (Funkční změna hesla existuje na `/account/security`.)
- Oba no-opy zobrazí anglický alert **„Settings updated / All changes synced with SkillStorm backend."** — nepravda [DEAD-BUG]+[JARGON].
- **[DEAD-BUG]** přepínače „Weekly analytics digest" a „GDPR data export reminders" bez state/handleru — dekorace.
- **2 zelené primary vedle sebe** (Uložit profil + Změnit heslo) [FLAG >1].
- Anglické bloky „Notifications & GDPR", „Invite members/code/link", „Copy" [JARGON]; `topicLevelId` v textu [UNCLEAR].
- Funkční části: pozvánky (generování/kopírování), témata, předměty, grade-level přepínače — [OK].

### 4.2 Správa učitelů `/app/settings/teachers`
- Akce funkční (teacher-access CRUD) [OK]. Sloupce „Name/Email/Role/Created", „No teachers yet", „Total teachers: N", raw role badge „TEACHER", „scoped access" [JARGON].

### 4.3 Školní roky `/app/academic-years`
- Nejčistší ředitelská obrazovka [OK]. Zpět-link vede na `/app/tests` [UNCLEAR]; dosažitelnost jen z assign modalu [MISPLACED] (0.2).

### 4.4 Audit log `/app/audit`
- Funkční, ale nedosažitelný (0.2). Raw enumy ve filtrech/tabulce pro tuto cílovku hraniční [UNCLEAR/OK]; „pouze pro role DIRECTOR a OWNER" [JARGON mírné].

### 4.5 Analytika (heatmapa, timeline)
- Nedosažitelné (0.2). Heatmapa: eyebrow **„Sprint 3"** + anglický H1 [DEAD-BUG/JARGON]. Timeline: raw status fallthrough, slovo „timeline" v empty state [JARGON mírné].

### 4.6 Podpora `/app/support`
- Raw RESOLVED/IN_REVIEW/OPEN/SUBJECT/HIGH (0.3) [JARGON]; „platform support inboxu" [JARGON]; empty state bez CTA na nahlášení [FLAG].

### 4.7 Rodič / Rodinný prostor
- **String „Rodinný prostor" v kódu neexistuje.** PARENT role je definovaná (VIEW_RESULTS/VIEW_SUBMISSIONS, landing `/app/results`), přepnutí role funguje (toast „Přepnuto do rodičovského zobrazení."), ale **žádná rodičovská obrazovka není** — rodič přistane na učitelské „Diagnostika výsledků" bez výběru dítěte. **[DEAD-PROMISE]** — klíčové pro prodej/pilot, kandidát na „poctivé připravujeme" (rozhodnutí u STOPu).

---

## 5. Legacy/mrtvé routy (kandidáti na smazání)

`client/src/middleware.ts:17-24,62-64` přesměrovává vše z `/dashboard*` na `/app/*` → celá skupina `(dashboard)` je fyzicky nedosažitelná.

| Routa | Verdikt |
|---|---|
| celý strom `(dashboard)/` (7 stránek + components) | **DEAD duplicate — smazat** (vše má kanonickou verzi v `(school)/app`) |
| `(dashboard)/tests` | DEAD — dvojité přesměrování — smazat |
| root `tests/create` | DEAD-PROMISE — redirect na `/app/tests` (ne `/app/tests/create`, ztrácí intent), 0 odkazů — smazat |
| `(content)/public-library` | DEAD-PROMISE — anglické demo, `demoItems=[]` → vždy prázdné, 0 odkazů — smazat |
| `(content)/test` | DEAD-PROMISE — statické anglické demo, odpovědní tlačítka **bez onClick**, Progress hardcoded 40 — smazat |
| `org/[orgId]/tests/[testId]` | DEAD duplicate — ignoruje vlastní `orgId`, 0 odkazů — smazat |
| `admin/organizations/[id]`, `admin/support` | redirect shimy na platform — neškodné, možno smazat |
| `qa/rbac-check` | QA fixture — před smazáním ověřit závislost e2e |

**Související bug:** `components/academic-years/CurrentAcademicYearBoundary.tsx:16-23` hlídá mrtvé prefixy `/dashboard*`, `/tests*` — na živých `/app/*` routách se guard nikdy nespustí. [DEAD-BUG → bug list]

---

## 6. Platform admin (interní, nižší priorita)

- Systémový CS/EN mix (sidebar anglicky, obsah míchaný) — rozhodnout jednotný jazyk interní plochy [JARGON].
- **`/app/platform/subscriptions`** — orphan (není v sidebaru), statické „Subscription management coming soon", **leakuje „Backend API: GET /platform/subscriptions"** do UI, USD ceny — **[DEAD-PROMISE]** schovat/smazat.
- Organizations: raw PENDING/ACTIVE/SUSPENDED badge hned vedle českých filtrů týchž hodnot [JARGON]; víc zelených „Schválit" najednou (per-row — přijatelné).
- Org health detail: playbook renderuje backendem dodané URL jako Link bez omezení [UNCLEAR — ověřit]; analytický žargon (Raw/Cap/Norm./Contrib.) [JARGON].
- Users: read-only bez správy — pokud se čeká správa, feature-level [DEAD-PROMISE].
- `health` = redirect alias [DUPLICATE, neškodné]. Audit/Support/Catalog/Forbidden funkční; Support+Catalog celé anglicky.
- Platform audit „Vyhledat" má bespoke violet barvu mimo design systém [design].

---

## 7. Bug list — [DEAD-BUG] (neopravovat v tomto auditu, vyseparovat)

1. Nastavení: no-op „Uložit profil" + „Změnit heslo" + falešný success alert + hardcoded „Alex Novak" + dekorativní přepínače (`(school)/app/settings/page.tsx`).
2. `student/tests/[testId]/page.tsx:19` — redirect na `/assignments/…` bez `/app` → 404.
2b. `assignments/page.tsx:33` — fallback `/app/results/${submissionId ?? a.id}` pošle ID zadání do routy pro odevzdání (při `attemptsUsed>0` a `submissionId=null`) → „Výsledek nebyl nalezen".
3. `tests/page.tsx:290-316` — publish/archive bez catch, tiché selhání; publish ze seznamu obchází kontrolu připravenosti.
4. Nedosažitelné routy: `/app/audit`, `/app/analytics*` (+ „Sprint 3" eyebrow v heatmapě).
5. `CurrentAcademicYearBoundary.tsx:16-23` — mrtvé prefixy, guard se nespouští.
6. `results/page.tsx` — syntetický trend, hardcoded trendPercent, `mistakeCount` = celkové chyby u všech témat.
7. `auth-form.tsx:285` — nestylovaná chyba jména.
8. Mrtvý kód: `canInlineEdit=false` blok (~250 ř.) + `console.log` v `tests/[testId]/page.tsx:256`.
9. Platform org detail: playbook LINK renderuje neomezené backend URL (ověřit server).
10. **Join flow tech-debt (viz 0.5):** deprecated `GET /invites/preview` + `POST /invites/accept` bez controller-level throttle (ekvivalentní ochrana v servisní vrstvě neověřena); `NoOrganizationScreen` na nekanonické cestě `/invites/*`; register obsahuje duplicitní join flow; cílový stav = jedna UX cesta přes `/join` + `/invitations/*`.

---

## 8. Kandidáti na removed-promises.md (rozhodnutí u STOPu, per kus)

| Co | Kde | Proč důležité | Návrh |
|---|---|---|---|
| Rodinný prostor / rodičovský pohled | žádná implementace; PARENT → učitelská diagnostika | klíčové pro prodej (guardian vertikála existuje v roadmapě — Etapa B) | **„poctivé připravujeme"** placeholder stránka pro roli PARENT |
| „Vyzkoušet demo" | public homepage | první dojem pro pilot | přejmenovat na „Vytvořit účet zdarma" NEBO nechat a postavit demo — rozhodnout |
| „Náhled aplikace" placeholder | public homepage | marketing | nahradit reálným screenshotem (portfolio záběry existují) nebo smazat sekci |
| Export PDF | results/page.tsx (3×) | učitelé/ředitelé to čekají | default smazat; případně „připravujeme" tooltip |
| Zvoneček (notifikace) | app-header.tsx:30 | slibuje notifikační systém | default smazat |
| Učitelská analytika bez výběru třídy | teacher/analytics | analytics vertikála v RFC | default: skrýt stránku, dokud nemá vstup |
| Odebrání žáka ze třídy | classrooms | správa tříd neúplná | spíš bug/gap než promise — rozhodnout |
| Žákovský pohled na Výpravu/Misi | neexistuje | kampaně jsou v prodejním příběhu | zapsat záměr, nic v UI neslibovat |
| Platform subscriptions | platform | interní | smazat stránku |
| Klik na „Hotovo" kartu → výsledek | StudentDashboard | routa existuje, jen chybí Link | tohle je spíš quick-win oprava než promise |

---

## TOP 20 nejhorších nálezů (seřazeno podle dopadu)

1. **Nastavení: „Změnit heslo" a „Uložit profil" nic nedělají a tvrdí opak** — no-op + „All changes synced with SkillStorm backend." + hardcoded „Alex Novak". [DEAD-BUG]
2. **Rodinný prostor neexistuje** — rodič po přepnutí role přistane na učitelské diagnostice. [DEAD-PROMISE]
3. **Žákovská navigace nefiltruje role** — žák vidí Třídy/Knihovna/Výsledky vedoucí na učitelské stránky (tab Testy pro žáka funguje — korekce z ověření). [MISPLACED]
4. **Ředitel nemá v navigaci Analytiku, Audit, Školní roky, Podporu** — 4 hotové obrazovky bez jediného odkazu. [DEAD-BUG]
5. **`student/tests/[testId]` přesměruje na 404** (chybí `/app` prefix). [DEAD-BUG]
6. **Tiché selhání Publikovat/Archivovat v seznamu testů** — bez catch, bez toastu, navíc obchází publish checklist. [DEAD-BUG]
7. **„Vyzkoušet demo" na homepage vede na registraci** — demo neexistuje. [DEAD-PROMISE]
8. **„Export PDF" věčně disabled** na výsledcích (3 větve). [DEAD-PROMISE]
9. **Učitel vidí WEAK/INSUFFICIENT_DATA** jako diagnózu žáka — enum mapa mapuje enum sám na sebe. [JARGON]
10. **Žák vidí PENDING/APPROVED/REJECTED** na svém výsledku. [JARGON]
11. **Role anglicky („teacher", „student") na 5 místech**, přestože česká mapa existuje a používá ji jediné místo. [JARGON]+[DUPLICATE]
12. **Celý mrtvý strom `(dashboard)` + `(content)` demos + `org/…` + root `tests/create`** — ~14 souborů nedosažitelného/duplicitního kódu. [DEAD → smazat]
13. **Anglické věty v české appce**: „Your role will be assigned…", „Registration is invite-only…", „Create org/Join org", „Notifications & GDPR", „Invite members". [JARGON]
14. **„Hotovo" karty na žákovském dashboardu nejsou klikací** — na vlastní výsledek se žák z dashboardu nedostane (routa přitom existuje). [UNCLEAR]
15. **Typy otázek raw enum** (TRUE_FALSE, MULTIPLE_CHOICE…) v detailu i editoru testu. [JARGON]
16. **Učitelská analytika chce ručně zadat `?classId=`** — žádný výběr třídy, žádný odkaz s parametrem. [DEAD-PROMISE-adjacent]
17. **Zvoneček bez funkce** v hlavičce pro všechny role. [DEAD-PROMISE]
18. **NoOrganizationScreen duplikuje create/join flow s JINÝM API** (`/invites` kód vs `/invitations` token). [DUPLICATE]
19. **„Sprint 3" jako viditelný text** v produkční heatmapě + anglický titulek. [DEAD-BUG/JARGON]
20. **>1 zelená primary**: Nastavení (2 vedle sebe), select-organization (N× „Použít"), add-students modal (tab + Zapsat), „Požádat správce…" zelené tlačítko, které jen vyhodí toast. [hierarchie]
