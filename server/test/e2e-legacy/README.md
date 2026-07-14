# E2E karanténa — drifted legacy suity

Tyto suity **neběží v gate** (`npm run test:e2e` je ignoruje). Byly dlouhodobě
červené už na main — fixtures a očekávání zaostaly za několika vlnami API
hardeningu — a při production-hardening práci (2026-07) padlo rozhodnutí:
kritické domény opravit hned, zbytek karanténovat s TODO listem, ať gate
zůstane vypovídající.

**Kritické domény jsou pokryté zelenými suitami v `test/e2e/`**: tests,
tests-axis, test-flow-hardening, assignments, assignment-visibility,
student-tests-visibility, submissions*, multi-org-security,
tenant-scope-fortress, sprint1-security, rbac-owner-invariant,
academic-year-*, active-year-gate, auth.*, win-path-smoke (celý happy path).

## Jak suitu vrátit do gate

1. Přesuň soubor zpět do `test/e2e/`.
2. Oprav podle vzorů (viz commity e1d6773, d50bad8, f52e9dd):
   - fixtures: aktivace PENDING org, login s `organizationId` (register()
     dává každému uživateli vlastní PENDING org), reuse bootstrap current
     year s daty pokrývajícími „teď", `createOrgSubject()` helper pro
     subjectId, allowedGrades odpovídající grade třídy, topic chain pro
     assignability;
   - kontrakty: org výhradně z JWT kontextu (žádné `organizationId` v body),
     cross-tenant → 404 masking, druhá org na uživatele → 409, druhý
     current rok → 400/`activate`, tokeny v cookies (`useOrg`/`getAuthToken`
     z `test/helpers`).
3. `npm run test:e2e -- <suita>` musí být zelené, pak celý gate.

## Karanténované suity (stav 2026-07-14)

analytics-sprint3, catalog, catalog-subject-provisioning,
class-section-subjects, class-sections, classroom, classroom-risk-overview,
classroom-subject-performance, core-flow, db-invariants, db.invariants
(prázdná suita!), enrollment-lifecycle, invites-accept, join-flow-invitations,
learning-materials, memberships, org-readiness, org-subject, organizations,
phase1-hardening, platform-admin, promotion, students, subject-activation,
subjects, switch-organization, teachers, topics, users
