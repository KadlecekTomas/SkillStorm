# Dev log — Focus Test Mode hardening (2026-06-17)

Three Focus Test Mode workstreams shipped to `main`.

## 1. Focus Test UX upgrade — PR #5 (`a601a44`)
Modernized the student answering shell:
- Top status bar shows the current position ("Otázka N z M") and an explicit answered percentage.
- Question navigator gained a "rozepsaná" (started / visited-but-unanswered) state with a dashed marker and accessible label.
- "Přeskočit" jumps to the next still-unanswered question (disabled when all are answered).
- Loading spinner replaced with a layout-matching skeleton.
- Earlier in the same line of work: reusable `student-answering/*` components, chrome-free focus route (`BootstrapGate chrome={false}`).

## 2. Submit-safety hardening — PR #6 (`c44f85c`)
The review dialog could let a student confirm "Odevzdat test" while autosave was still saving or had failed. Final submit is now gated on a safe-save state:
- `saving` / unsaved → confirm disabled + "odpovědi se ještě ukládají".
- save `error` → confirm disabled + "nepodařilo uložit"; "Zpět do testu" recovery stays available.
- offline (unchanged) → still blocked; everything saved → submit works as before.

Pure UI gating in `ReviewBeforeSubmitDialog`; autosave/submit hook, backend contracts, analytics, RBAC and tenant logic untouched.

## 3. Playwright coverage + diagnostics — PR #6 (`3aa2cc4`, `48cd30f`, `ceab8f5`)
- New focus e2e specs: access/security, student journey, persistence, responsive, submit-safety, on a shared resilient helper (`tests/e2e/helpers/focus.ts`).
- Fixed a mobile horizontal overflow in the nav row (`flex-wrap`).
- Diagnostics: a diagnostics-enabled `test` fixture captures console + failed/4xx-5xx API requests and attaches a JSON UI-state snapshot on failure; `test.step` per phase; precise skip reasons; `playwright.config` keeps trace/screenshot only on failure.

## Verification at merge
- `tsc --noEmit` ✅ · Vitest 163 passed ✅ · Playwright focus suite 27 passed / 8 skipped / 0 failed ✅ (run with `--workers=1`).

## Known gaps / next
- Focus e2e suite shares one resumed backend attempt → run with `--workers=1`; several scenarios skip when the local attempt is already fully answered.
- **Cross-org assignment negative is currently covered only via the scoped-404 path with a random foreign id.** A *real* "exists-but-forbidden" cross-tenant assertion needs a deterministic multi-org seed (a student in org A + a real assignment in org B). ← next workstream.
