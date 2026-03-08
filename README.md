# SkillStorm (backend)

SkillStorm je backend pro správu testů, přiřazení, odevzdání a vyhodnocení v rámci organizací.  
Podporuje více rolí a striktní RBAC s kontrolou organizačního scope.  
Není to školní ERP – neřeší rozvrhy, finance ani personální agendu.

## Tech stack
- NestJS
- Prisma ORM
- PostgreSQL

## Quick start (lokální běh)

### Požadavky
- Node.js (LTS)
- npm
- PostgreSQL (nebo Docker pro lokální DB)
- `jq` (doporučeno pro smoke scénář)

### Instalace
```bash
cd server
npm install
```

### Env proměnné
Vytvoř soubor `server/.env` a nastav minimálně:
- `DATABASE_URL` – připojení na PostgreSQL
- `JWT_SECRET` – tajný klíč pro JWT

Volitelné:
- `REDIS_URL` – Redis pro cache
- `CACHE_TTL_SECONDS` – TTL pro cache
- `PORT` – port backendu
- `DISABLE_THROTTLE` – vypnutí rate limitu (pouze lokálně)
- `DISABLE_CSRF` – vypnutí CSRF ochrany (pouze lokálně)

### Supported Production Topology
- Production auth is cookie-only and supported by default only in same-site deployment.
- Supported topology: browser -> `PUBLIC_APP_URL` (Next.js) -> `/api/*` reverse proxy -> Nest backend.
- `PUBLIC_APP_URL` and `API_URL` must be same-site in production, unless `ALLOW_CROSS_SITE_COOKIES=1` is explicitly set after review.
- `CORS_ORIGINS` must be an explicit allowlist. Wildcards are rejected at startup.
- Client-side RBAC telemetry is disabled by default in production. Authorization denies are recorded server-side by Nest.

### Migrace / seed
```bash
cd server
npx prisma migrate deploy
```

Volitelný demo seed:
```bash
cd server
npm run seed:demo
```

### Start
```bash
cd server
npm run start:dev
```

### Lokální DB přes Docker (volitelné)
Pokud projekt obsahuje `docker-compose.yml` s PostgreSQL službou.

```bash
docker-compose up -d postgres
```

=== Security and authorization notes ===
The backend enforces strict role-based access control (RBAC) combined with organization scoping.  
All sensitive operations are protected either by explicit permission guards or by role checks at the service layer.

Key security decisions:

- **Fail-fast strategy**:  
  Operations that would lead to inconsistent or invalid state (e.g. assigning an unpublished or unscorable test) are rejected before any data is created.
- **No silent success**:  
  Submissions without valid scoring configuration are explicitly rejected instead of being partially evaluated.
- **Soft-delete aware authorization**:  
  Memberships marked as deleted are ignored in all authorization paths, preventing access after removal.
- **Server-side membership resolution**:  
  Teacher dashboards and statistics do not rely on membership identifiers embedded in JWT tokens.  
  Membership is resolved server-side based on `userId` and `organizationId`, reducing token coupling and improving safety.

### Note on test logs

Some authentication end-to-end tests intentionally trigger error scenarios (e.g. duplicate registration, invalid login).  
These scenarios produce expected error logs during test execution but do not indicate runtime instability or security issues.

=== Minimal End-to-End API Smoke Scenario ===
This section demonstrates the minimal happy-path flow that proves the system is functional without any manual database intervention.

Poznámka: odpovědi jsou obalené do `{ success, data }`.  
V příkladech používáme `jq` pro extrakci hodnot z `.data`.  
Poznámka: produkční auth flow používá HttpOnly cookies přes same-site `/api` proxy. Starší Bearer ukázky níže jsou historické a nejsou doporučený produkční pattern.

1) Register + login (DIRECTOR)
```bash
DIRECTOR_REGISTER=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Director","email":"director@example.com","username":"director1","password":"Password123!","mode":"CREATE_ORG"}')

ORG_ID=$(echo "$DIRECTOR_REGISTER" | jq -r '.data.organization.id')

DIRECTOR_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"director@example.com","password":"Password123!"}' \
  | jq -r '.data.sessionToken')
```

2) Register student user + add membership to org
```bash
STUDENT_REGISTER=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Student","email":"student@example.com","username":"student1","password":"Password123!","role":"STUDENT"}')

STUDENT_USER_ID=$(echo "$STUDENT_REGISTER" | jq -r '.data.user.id')

STUDENT_MEMBERSHIP=$(curl -s -X POST http://localhost:3000/api/memberships \
  -H "Authorization: Bearer $DIRECTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$STUDENT_USER_ID\",\"organizationId\":\"$ORG_ID\",\"role\":\"STUDENT\"}")

STUDENT_MEMBERSHIP_ID=$(echo "$STUDENT_MEMBERSHIP" | jq -r '.data.id')
```

3) Create student entity (linked to membership)
```bash
STUDENT_ENTITY=$(curl -s -X POST http://localhost:3000/api/students \
  -H "Authorization: Bearer $DIRECTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"membershipId\":\"$STUDENT_MEMBERSHIP_ID\",\"orgId\":\"$ORG_ID\"}")

STUDENT_ID=$(echo "$STUDENT_ENTITY" | jq -r '.data.id')
```

4) Student login + use org
```bash
STUDENT_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.com","password":"Password123!"}' \
  | jq -r '.data.sessionToken')

STUDENT_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/use-org \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orgId\":\"$ORG_ID\"}" \
  | jq -r '.data.sessionToken')
```

5) Create class section + enroll student
```bash
CLASS_SECTION=$(curl -s -X POST http://localhost:3000/api/class-sections \
  -H "Authorization: Bearer $DIRECTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"grade":"GRADE_1","section":"A","label":"1.A"}')

CLASS_SECTION_ID=$(echo "$CLASS_SECTION" | jq -r '.data.id')

curl -s -X POST http://localhost:3000/api/enrollments \
  -H "Authorization: Bearer $DIRECTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\":\"$STUDENT_ID\",\"classSectionId\":\"$CLASS_SECTION_ID\"}" >/dev/null
```

6) Create test + add question + publish
```bash
TEST=$(curl -s -X POST http://localhost:3000/api/tests \
  -H "Authorization: Bearer $DIRECTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Core Test\",\"organizationId\":\"$ORG_ID\"}")

TEST_ID=$(echo "$TEST" | jq -r '.data.id')

QUESTION=$(curl -s -X POST http://localhost:3000/api/tests/$TEST_ID/questions \
  -H "Authorization: Bearer $DIRECTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Is 1 < 2?","type":"TRUE_FALSE","correctAnswer":"true","order":1}')

QUESTION_ID=$(echo "$QUESTION" | jq -r '.data.id')

curl -s -X PATCH http://localhost:3000/api/tests/$TEST_ID \
  -H "Authorization: Bearer $DIRECTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"PUBLISHED"}' >/dev/null
```

7) Assign test + student submits + finish
```bash
ASSIGNMENT=$(curl -s -X POST http://localhost:3000/api/tests/$TEST_ID/assign \
  -H "Authorization: Bearer $DIRECTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"classSectionId\":\"$CLASS_SECTION_ID\",\"openAt\":\"2025-01-01T10:00:00Z\",\"closeAt\":\"2025-01-01T12:00:00Z\",\"maxAttempts\":1,\"shuffle\":false,\"showExplain\":\"NEVER\"}")

ASSIGNMENT_ID=$(echo "$ASSIGNMENT" | jq -r '.data.id')

curl -s -X GET http://localhost:3000/api/assignments/my \
  -H "Authorization: Bearer $STUDENT_TOKEN" >/dev/null

SUBMISSION=$(curl -s -X POST http://localhost:3000/api/submissions \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"assignmentId\":\"$ASSIGNMENT_ID\"}")

SUBMISSION_ID=$(echo "$SUBMISSION" | jq -r '.data.id')

curl -s -X PATCH http://localhost:3000/api/submissions/$SUBMISSION_ID/responses \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"responses\":[{\"questionId\":\"$QUESTION_ID\",\"givenText\":\"true\"}]}" >/dev/null

curl -s -X POST http://localhost:3000/api/submissions/$SUBMISSION_ID/finish \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' >/dev/null
```

8) Read results
```bash
curl -s -X GET http://localhost:3000/api/tests/$TEST_ID/results \
  -H "Authorization: Bearer $DIRECTOR_TOKEN"
```

## Known limitations / scope
- `ImportBatch` / `ExportLog` nejsou implementované.
- `AcademicYear` je implicitní, pokud `yearId` chybí při vytváření class section.
- API pro správu AcademicYear není součástí backendu.

## Testing
Spouštěj z `server`:
```bash
npm test
npm run test:e2e
```

Poznámka: některé auth e2e testy záměrně vyvolávají chyby (duplicitní registrace, invalid login) a generují očekávané error logy.

**Onboarding create-organization invariant** je chráněn backend E2E testem (DB + auth kontrakt) a frontend Playwright testem (routing + context + refresh). Tyto testy musí v CI procházet. Více: [docs/testing.md](docs/testing.md).

## License / Contributing
Repo je určen pro interní/akademické použití.  
Příspěvky posílej přes PR s krátkým popisem změn.
```
