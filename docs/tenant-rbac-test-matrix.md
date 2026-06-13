# Tenant Isolation and RBAC Negative Test Matrix

Datum: 2026-06-10

## Testovací styl

Backend používá primárně Jest e2e testy přes Supertest pro endpoint-level kontrakty. Doplňkově existují Jest unit testy služeb/guardů a Vitest policy testy. Frontend používá Vitest pro komponenty/policy a Playwright pro browser e2e. Pro tenant isolation/RBAC negativní scénáře je preferovaný backend Jest e2e, protože ověřuje reálné guards, JWT kontext, DTO validaci a service scoping na HTTP hranici.

## Status code policy

Aktuální konvence je kombinovaná:

* `404 Not Found` pro cross-tenant lookup existující cizí entity, kde nechceme potvrdit existenci resource.
* `403 Forbidden` pro známý vlastní tenant, ale chybějící role/permission.
* Některé legacy endpointy vracejí `403` i při cross-tenant přístupu, zejména pokud guard nejprve ověřuje org mismatch. Matrix proto u vybraných starších endpointů povoluje `403/404` a označuje konvenci jako kandidáta na sjednocení.

## Matrix

| Endpoint / oblast | Role | Org A actor | Org B resource | Očekávaný status | Existující test | Priorita | Poznámka |
|---|---|---|---|---|---|---|---|
| `GET /organizations/:id` | teacher/student | org A member | org B organization | 403/404 | ne | P1 | Doplnit po zmapování organization endpointů. |
| `PATCH /organizations/:id` | teacher | org A teacher | org B organization | 403/404 | ne | P1 | Owner/director boundaries vyžadují samostatnou sadu. |
| `PATCH /organizations/:id` | student | org A student | own/org B organization | 403 | ne | P1 | Role denial. |
| support/platform org access | SUPPORT/SUPERADMIN | platform actor | org data | explicit allow/deny | částečně | P1 | Existují platform/admin testy, matrix potřebuje rozšířit. |
| `GET /class-sections/:id` | teacher/director | org A actor | org B class section | 404 | ano | P0 | `multi-org-security`, `tenant-scope-fortress`. |
| `PATCH /class-sections/:id` | director | org A director | org B class section | 403/404 | ano | P0 | Přidáno v `tenant-scope-fortress`. |
| `GET /classrooms/:id/risk-overview` | teacher | org A teacher | org B class section | 403/404 | ano | P0 | `tenant-scope-fortress`. |
| `GET /students/:id/detail` | teacher/director | org A actor | org B student | 403/404 | ano | P0 | Přidáno pro director; student access guard má další testy. |
| `PATCH /students/:id` | teacher/director | org A actor | org B student | 403/404 | ne | P0 | Zbývá endpoint-level coverage. |
| `POST /enrollments` / transfer | teacher/director | org A actor | org B student/class | 403/404 | částečně | P0 | Service unit testy existují, e2e rozšíření zbývá. |
| `GET /tests/:id` | teacher | org A teacher | org B test | 403/404 | ano | P0 | `tenant-scope-fortress`, `multi-org-security`. |
| `PATCH /tests/:id` | teacher | org A teacher | org B test | 403/404 | ano | P0 | Přidáno explicitně pro TeacherA. |
| `DELETE /tests/:id` | teacher/director | org A actor | org B test | 404 | ano | P0 | `multi-org-security`; teacher delete denied by RBAC too. |
| `POST /tests/:id/assign` | teacher/director | org A actor | org B test/class | 404 | ano | P0 | `multi-org-security`. |
| `POST /assignments` | teacher | org A teacher | org B class section | 403/404 | ano | P0 | Přidáno explicitně pro TeacherA. |
| `GET /assignments/:id` | student | org A student | org B assignment | 403/404 | ano | P0 | Přidáno direct assignment detail test. |
| `PATCH /assignments/:id` | teacher/director | org A actor | org B assignment | 404 | ano | P0 | `multi-org-security`. |
| `GET /submissions/:id` | student | org A student | org B submission | 403/404 | ano | P0 | `tenant-scope-fortress`. |
| `PATCH /submissions/:id/responses` | student | org A student | org B submission | 403/404 | ne | P0 | Zbývá doplnit mutation coverage. |
| `GET /tests/:id/results` | teacher | org A teacher | org B results | 404 | ano | P0 | `multi-org-security`. |
| analytics endpoints | teacher | org A teacher | org B year/class/student | 400/403/404 | částečně | P0 | Year spoofing a classroom analytics testy existují. |
| import students | teacher/director | org A actor | org B class/year | 403/404 | ne | P1 | Import API používá active org; doplnit class spoof test. |
| export students | teacher/director | org A actor | org B data | 403/no leak | ne | P1 | Potřebuje data-leak assertion. |
| `GET /audit` | teacher/student | org member | own/org audit | 403 | částečně | P1 | Audit deep e2e existuje na frontendu; backend matrix rozšířit. |
| support tickets | teacher/student/support | mixed | cross org support data | explicit allow/deny | částečně | P1 | Support role boundaries doplnit samostatně. |
| teacher without permission | teacher | org A teacher | own org create test/assignment | 403 | ano | P0 | Přidáno org-specific denied rolePermission test. |
| student admin endpoints | student | org A student | own org teacher/admin endpoints | 403 | ano | P0 | Přidáno pro tests, assignments, students list. |

## Zbývající P0 mezery

* `PATCH /students/:id` cross-tenant endpoint-level test.
* Enrollment mutation e2e pro cross-tenant student/class transfer.
* Submission mutation e2e pro cross-tenant `responses`/`finish`.

Tyto mezery jsou úzké a navazují na již existující service/endpoint coverage; měly by být dokončené před produkčním spuštěním školního pilotu.
