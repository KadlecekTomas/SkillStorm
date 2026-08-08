# SkillStorm

> **Status:** active development  
> **Product:** curriculum-aware educational SaaS for schools, teachers, students, families and learning communities  
> **Primary school direction:** turn RVP/ŠVP goals into practical Lesson Experiences that work on the hardware a school actually has.

SkillStorm combines school organization, content, testing and learning evidence with an evolving **Interactive Curriculum** layer. The long-term product goal is not to digitize worksheets; it is to let a teacher open a class, see what is relevant to that school's curriculum, choose a supported classroom mode and start a high-quality lesson.

The repository currently contains both **implemented contracts** and **approved future architecture**. Their authority and precedence are defined in [`docs/README.md`](./docs/README.md). Do not infer implementation status from a vision document alone.

---

## Documentation — start here

### Normative contracts

- [Documentation Registry](./docs/README.md) — authority, status and precedence of all project documentation.
- [Master Roadmap](./docs/roadmap/master.md) — the single active source of truth for implementation order.
- [Interactive Curriculum Production Contract](./docs/interactive-curriculum/PRODUCTION-CONTRACT.md) — cross-cutting production invariants: curriculum, classroom realtime, privacy, accessibility, safety, resilience, evidence and release gates.
- [Curriculum Data Contract](./docs/interactive-curriculum/CURRICULUM-DATA-CONTRACT.md) — RVP/ŠVP versioning, mappings, curriculum applicability and coverage semantics.
- [Subject Blueprint Standard](./docs/interactive-curriculum/subjects/SUBJECT-BLUEPRINT-STANDARD.md) — mandatory pedagogical/product structure and release gates for every subject vertical.

### Approved product blueprints

- [SkillStorm Interactive Curriculum](./docs/interactive-curriculum/README.md) — whole-school product north star across subjects and classroom hardware modes.
- [Interactive Curriculum — Master Use Cases](./docs/interactive-curriculum/USE-CASES.md) — detailed use cases across grades 1–9.
- [School Curriculum Coverage & ŠVP Integration](./docs/interactive-curriculum/SCHOOL-CURRICULUM-COVERAGE.md) — school-facing curriculum/coverage UX and all 10 RVP ZV areas.
- [All 18 Subject Blueprints](./docs/interactive-curriculum/subjects/README.md) — detailed production-spec pedagogical blueprints for every educational field in the revised RVP ZV.
- [Audio & Language Learning Engine](./docs/interactive-curriculum/AUDIO-LANGUAGE-ENGINE.md) — curated audio, timed text, listening interactions and recommended Czech-language progression.
- [Interactive IT Lab](./docs/interactive-it-lab/README.md) — detailed device-first engine blueprint including Build-a-PC and Teacher Mission Control.
- [Interactive IT Lab — Full-year Informatics 4–9](./docs/interactive-it-lab/YEAR-COVERAGE.md) — 192 core lesson definitions, pacing/FLEX variants, RVP/OVU evidence paths, school ŠVP adaptation and production requirements for the complete informatics vertical.

### Current implemented classroom contracts

- [Live Sessions](./docs/live-sessions.md)
- [Live Sessions — interactive rounds](./docs/live-sessions-interactions.md)

For security, operations, analytics, historical audits and additional specifications, use the registry rather than browsing filenames and assuming the newest-looking document is authoritative.

---

## Technology

Current repository architecture:

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** NestJS, TypeScript
- **Data:** PostgreSQL + Prisma
- **Realtime / coordination:** Redis is part of the local stack; individual features define whether it is required for their runtime contract
- **Containerization:** Docker Compose
- **Testing:** unit/integration/e2e plus real-browser Playwright scenarios

The exact package versions and scripts in `package.json`, lockfiles and CI workflows are authoritative over prose documentation.

---

# Local development with Docker

## Requirements

- Docker
- Docker Compose

## 1. Environment

Create a local environment file from the tracked template:

```bash
cp .env.example .env
```

Then fill every value required by your local workflow.

**Do not copy example secrets from README files.** `.env.example` is the canonical list of supported environment variables; real secrets must never be committed.

In particular, current authentication configuration uses the dedicated access/refresh secret variables from `.env.example`. Legacy `JWT_SECRET` compatibility in server code is not the canonical setup for new environments.

## 2. Start the development stack

Development services are behind the Compose `dev` profile:

```bash
docker compose --profile dev up --build
```

Do not use plain `docker compose up --build` for the full local stack; without the intended profile no development service set is selected.

Check status:

```bash
docker compose --profile dev ps
```

Default local endpoints:

- Frontend: <http://localhost:3000>
- Backend health: <http://localhost:4200/health>

## 3. Start only PostgreSQL and Redis

```bash
docker compose --profile dev up -d postgres redis
```

## 4. Initialize / reseed the local development database

```bash
docker compose --profile dev run --rm seed-full
```

This command is intended for a local development environment. Before running destructive database operations, verify which environment/database your `.env` points to.

## 5. Start backend and frontend

```bash
docker compose --profile dev up -d backend frontend
```

## 6. Stop the stack

```bash
docker compose --profile dev down
```

`down -v` also removes Docker volumes and therefore local database state. Use it only when that data loss is intentional:

```bash
docker compose --profile dev down -v
```

---

# Development rules

1. **TypeScript only** for application code unless an existing tool/config explicitly requires another language.
2. **Tenant isolation and RBAC are server-side invariants.** Client UI visibility is never authorization.
3. **Prisma schema changes require migration + generated client + tests.**
4. **Do not commit `.env` or secrets.**
5. **Do not implement a future blueprint by bypassing existing production/security contracts.** Resolve the documentation conflict first.
6. **A changed contract requires changed tests and documentation in the same PR.**
7. **Historical audits are evidence, not current instructions.** Their status is defined in [`docs/README.md`](./docs/README.md).
8. **A new subject vertical must conform to the Subject Blueprint Standard before implementation starts.**

---

# Interactive Curriculum development gate

Before a new subject engine or Lesson Experience is called production-ready, it must satisfy the gates in:

- [`PRODUCTION-CONTRACT.md`](./docs/interactive-curriculum/PRODUCTION-CONTRACT.md)
- [`CURRICULUM-DATA-CONTRACT.md`](./docs/interactive-curriculum/CURRICULUM-DATA-CONTRACT.md)
- [`SUBJECT-BLUEPRINT-STANDARD.md`](./docs/interactive-curriculum/subjects/SUBJECT-BLUEPRINT-STANDARD.md)

This includes pedagogical review, curriculum provenance/mapping, accessibility, privacy/security, asset licensing, classroom resilience, semantic telemetry, reconnect behavior, learning-evidence semantics and real-browser validation.

The complete subject catalog is maintained in [`docs/interactive-curriculum/subjects/README.md`](./docs/interactive-curriculum/subjects/README.md). It covers all 18 educational fields in the revised RVP ZV, but blueprint existence does **not** mean that every OVU is already implemented or content-complete.

The repository must never claim `RVP complete`, `production ready` or equivalent purely because a topic tag, blueprint or demo exists.

---

# Repository safety

- `main` is the stable integration branch and is protected by required checks.
- Larger changes should use an isolated feature/fix branch and pull request.
- Never force-push shared/stable branches unless repository policy explicitly requires and authorizes it.
- Keep migrations, API contracts and documentation reviewable as intentional units.

For the current implementation sequence, see [`docs/roadmap/master.md`](./docs/roadmap/master.md).
