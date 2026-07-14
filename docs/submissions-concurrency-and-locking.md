# Souběh v submission flow — zamykání a DB závislosti

## Strategie: pesimistický řádkový zámek

`updateResponses()` i `finish()` (`server/src/submissions/submissions.service.ts`)
běží v transakci, která začíná:

```sql
SELECT submission_id FROM submissions WHERE submission_id = $1 FOR UPDATE
```

a **až po získání zámku** znovu načte stav submission (re-read), takže
rozhodnutí (je už odevzdáno? existuje response pro otázku?) se dělají nad
zamčeným, aktuálním stavem.

**Proč pesimisticky, ne optimisticky (verze + retry):**

- Kontence je prakticky výhradně per-submission (autosave bursty jednoho
  žáka, double-click na submit). Třicet žáků současně = 30 různých řádků,
  které se navzájem neblokují — viz zátěžový test níže.
- Transakce jsou krátké (validace + pár upsertů), takže čekání na zámek je
  v jednotkách ms; optimistický retry by řešil identický scénář složitěji
  (retry smyčky v klientovi/serveru) bez měřitelného přínosu.
- Upsert odpovědi je find→create/update; bez zámku závodí sám se sebou
  (duplicitní response řádky). Zámek tuto race odstraňuje kořenově.

`finish()` je navíc **idempotentní**: druhé volání vidí `submittedAt` a vrací
stejný payload (200), žádný konflikt pro double-click.

## DB závislosti (druhá obranná linie)

Aplikace se vědomě opírá o dva databázové mechanismy:

1. **Trigger `responses_lock_after_submit`** (migrace
   `20260222110000_responses_lock_after_submit_trigger`): jakýkoli
   INSERT/UPDATE/DELETE na `responses` u odevzdané submission vyhodí
   `SUBMISSION_LOCKED` (P0001). Aplikace ho mapuje na 409. Chrání data i
   proti cestám mimo service (ruční SQL, budoucí endpointy).
2. **Trigger `enrollment_org_consistency`** (migrace
   `20260714090000_enforce_enrollment_org_consistency`): enrollment musí
   držet org konzistenci membership × class section.

**Canary test:** `server/test/e2e/responses-lock-trigger.e2e-spec.ts`
kontroluje existenci obou triggerů v pg_catalog **a** chování (přímý zápis
přes Prisma do zamčené submission musí selhat). Pokud by trigger zmizel
(neopatrná migrace, restore ze starého dumpu), gate spadne.

## Zátěžový test

`server/test/e2e/submissions-concurrency-load.e2e-spec.ts` — 30 žáků,
stejný assignment, skutečně paralelní requesty (`Promise.all`):

1. 30× souběžný `POST /submissions`,
2. 3 kola × 30 souběžných `PATCH /submissions/:id/responses`,
3. autosave burst (5 paralelních PATCHů téže submission) — po něm právě
   jeden response řádek, žádné duplicity,
4. 30× souběžný `POST /submissions/:id/finish` + duplicitní finish
   (idempotence).

Kritéria (vynucená asserty): žádná ztracená odpověď (ground truth v DB),
žádný deadlock, žádná 5xx, všech 30 submissions oznámkováno.

Naměřeno lokálně (macOS, jedna Postgres instance, 2026-07-14):

| Operace | n | p50 | p95 | max |
|---|---|---|---|---|
| POST /submissions (30 paralelně) | 30 | 113 ms | 121 ms | 121 ms |
| PATCH :id/responses (3×30 paralelně) | 90 | 86 ms | 166 ms | 170 ms |
| POST :id/finish (30 paralelně) | 30 | 130 ms | 177 ms | 182 ms |
