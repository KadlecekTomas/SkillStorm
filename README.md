# 🧩 SkillStorm – Modern Educational Platform (Bachelor Thesis Project)

> **SkillStorm** is a full-stack educational SaaS platform developed as a bachelor thesis project.  
> The goal is to design and implement a secure, modular and scalable web application for schools,  
> teachers and students — supporting online learning, testing, and class management through  
> a clean, gamification-ready architecture.

---

## 🚀 Project Overview

SkillStorm combines:
- 🏫 **School management** – organizations, classes, users, roles  
- 📚 **Learning content library** – materials, practice tasks, and tests  
- 🧪 **Interactive testing** – question banks, automatic grading, submissions  
- 📥 **Import/export** – student lists and test results  
- 🔐 **Secure RBAC system** – access control, audit logs, and data isolation  

The platform is written in **TypeScript** across the stack and designed with  
**Next.js (frontend)**, **NestJS (backend)**, **Prisma (ORM)** and **PostgreSQL (DB)**.  
All services are containerized with **Docker** and integrated via **CI/CD** pipelines.

---

## 🧠 Objectives

The bachelor thesis aims to:

1. Design a **multi-layered web system** supporting educational workflows.
2. Implement a **modular backend API** (NestJS + Prisma) with RBAC security.
3. Build a **Next.js frontend** for users and organization management.
4. Provide **data import/export capabilities** (CSV/XLSX/PDF).
5. Ensure **deployment readiness** through Docker and GitHub Actions.
6. Document the **software architecture and development process**.

---

## 🚀 Quick Start (Full Stack)

> The repo is split into `/client` (Next.js frontend) and `/server` (NestJS backend).  
> The root `package.json` only exposes the `npm run audit` helper.

### 1. Clone & Install

```bash
git clone https://github.com/skillstorm/app.git
cd app

# frontend deps
cd client && npm install

# backend deps
cd ../server && npm install
```

### 2. Prepare Environment Variables

- Root: `.env` (template in `.env.example`) – contains shared ports, DB creds, Redis, etc.
- Frontend: `client/.env` (template provided) – sets `NEXT_PUBLIC_API_URL`.
- Backend: `server/.env` (template provided) – sets `DATABASE_URL`, `JWT_SECRET`, `PORT`.

Copy the examples and adjust to your local stack if needed.

### 3. Run the Stack

```bash
# Terminal 1 – NestJS API
cd server
npx prisma db seed   # optional: populate demo data
npm run start:dev

# Terminal 2 – Next.js App Router (Turbopack dev server)
cd client
npm run dev
```

- Frontend dev server: http://localhost:3001 (falls back if :3000 busy)
- Backend API: http://localhost:3000

### 4. Quality Gates

```bash
# Frontend
cd client
npm run lint
npm run build

# Backend
cd server
npm run lint
npm run build

# Repo-wide audit (lint + build + env checks)
cd ..
npm run audit
```

All three (`lint`, `build`, `audit`) must complete without errors to consider the project healthy.

### 5. Demo Accounts

Seeding creates these ready-to-use accounts:

- Superadmin: `admin@example.com` / `admin123`
- Director: `director@example.com` / `director123`
- Teachers: `teacher@example.com`, `eva.novakova@skillstorm.test` (password `teacher123`)
- Students: `student@example.com`, `nela.studentova@skillstorm.test` (password `student123`)

Feel free to duplicate or reset them via `cd server && npx prisma db seed`.

---

## 🧩 Architecture

| Layer | Technology | Description |
|-------|-------------|--------------|
| **Frontend** | Next.js 15 + TypeScript + Tailwind CSS | Dynamic user interface, dashboard views, class & test management |
| **Backend** | NestJS 11 + TypeScript + Prisma ORM | Modular REST API, authentication, RBAC, CRUD endpoints |
| **Database** | PostgreSQL | Structured relational storage with Prisma schema & migrations |
| **Infrastructure** | Docker Compose + GitHub Actions | Local & CI environment with automated build/test pipelines |
| **Testing** | Jest + Supertest | Unit & E2E testing for backend, prepared structure for frontend tests |
| **Documentation** | Swagger + Markdown | API reference, developer setup guide, architecture overview |

---

## 📂 Repository Structure

```
.
├── client/                    # Next.js frontend
│   ├── app/                   # App Router pages
│   ├── components/            # UI components
│   ├── lib/                   # API fetchers, utils
│   └── public/                # Static assets (logos, icons)
│
├── server/                    # NestJS backend
│   ├── src/
│   │   ├── auth/              # JWT, guards, refresh tokens
│   │   ├── users/             # User CRUD + roles
│   │   ├── organizations/     # Organizations, classes, memberships
│   │   ├── learning/          # Materials, practice, tests
│   │   ├── submissions/       # Test responses and grading
│   │   ├── import-export/     # CSV/XLSX/PDF import & export (planned)
│   │   ├── shared/            # Guards, interceptors, RBAC helpers
│   │   └── main.ts            # Entry point + Swagger config
│   ├── prisma/                # Database schema & migrations
│   └── test/                  # e2e tests
│
├── docker-compose.yml         # Dev containers (client, server, db)
├── .github/workflows/ci.yml   # CI pipeline
├── docs/                      # ERD, diagrams, additional notes
└── README.md                  # This file
```

---

## ⚙️ Functional Modules (MVP Scope)

| Module | Status | Description |
|---------|---------|-------------|
| 🔐 **Authentication & RBAC** | 65 % | JWT login/refresh/logout, role guards, password reset (pending) |
| 🧑‍🏫 **Organizations & Users** | 60 % | CRUD for users, classes, memberships, roles (SCHOOL/PRIVATE/COMMUNITY) |
| 📚 **Content Library** | 55 % | Upload & serve learning materials, categorized by subject/topic/type |
| 🧪 **Testing & Evaluation** | 65 % | Questions, submissions, scoring, attempt history |
| 📥 **Import/Export** | 20 % | CSV/XLSX import/export, PDF reporting (planned) |
| ⚙️ **Access Control & Logs** | 60 % | Guard-based RBAC, basic audit logging (UI pending) |
| 🐳 **DevOps / CI / Docs** | 40 % | Docker fixes, environment templates, CI tests and docs |

---

## 📈 Roadmap

| Milestone | Description | Status |
|------------|-------------|--------|
| ✅ Backend Core API | NestJS modules + Prisma schema completed | Done |
| 🧩 Frontend MVP | Next.js UI for auth, dashboard, content, testing | In progress |
| 📦 Import/Export Engine | CSV/XLSX ingest & export pipelines | Planned |
| 🐳 CI/CD Infrastructure | Docker build, lint/test pipeline | Planned |
| 📚 Documentation Suite | README, Swagger, ERD, architecture diagram | Planned |
| 🚀 MVP Launch | Fully functional system demonstration | Target: 2025 |

---

## 🔒 Security

- Passwords hashed with **bcrypt**
- JWT authentication with refresh token rotation
- **Role-based access control (RBAC)** on every route
- Multitenancy support (isolated organization data)
- Basic **audit logging** for CRUD operations

---

## 🧰 Local Development Setup

### 1️⃣ Clone Repository

```bash
git clone https://github.com/skillstorm/app.git
cd app
```

### 2️⃣ Configure Environment

```bash
cp .env.example .env
```

Adjust secrets (e.g. `JWT_SECRET`) and service ports as needed.

### 3️⃣ Start Docker Environment

```bash
docker-compose up --build
```

### 4️⃣ Database Setup

```bash
cd server
npx prisma migrate dev
npx prisma generate
```

### 5️⃣ Run Backend

```bash
npm run start:dev
```

### 6️⃣ Run Frontend

```bash
cd ../client
npm run dev
```

Swagger API is available at: **http://localhost:3000/api**

---

## 🧭 Development Guidelines

- Use TypeScript everywhere
- Follow Clean Architecture + SOLID principles
- Commit conventions: `feat`, `fix`, `refactor`, `docs`, `chore`
- All commits go to `develop`; reviewed merges into `main`
- Run lint & tests before pushing

---

## 🧪 Testing

```bash
# Run all backend tests
cd server
npm run test
```

E2E tests are located in `server/test/e2e/`.
Frontend test structure is prepared under `client/__tests__/`.

---

## 🔐 RBAC Overview

| Permission | Description |
| --- | --- |
| CREATE_TEST | Allows creating new tests and assessments within the organization. |
| EDIT_TEST | Allows editing and reordering questions for existing tests. |
| DELETE_TEST | Allows archiving or deleting tests and their questions. |
| VIEW_RESULTS | Allows viewing aggregated results and individual submissions. |
| MANAGE_STUDENTS | Allows inviting students, editing enrollments, and assigning work. |
| MANAGE_TEACHERS | Allows inviting teachers and adjusting their organization roles. |

These permissions mirror the backend `PermissionKey` enum and should stay in sync with Swagger docs (`/docs` → RBAC Overview).

---

## 🔐 RBAC Phase 3 – Tests & CLI

Commands:

```bash
# Backend RBAC test pack (guards, cache, audit side-effects)
cd server && npm run test -- rbac

# Frontend RBAC tests (Vitest + Playwright with auto-started dev server)
cd client && npm run test:rbac:client

# Controller decorator checker
npm run check:rbac
```

Telemetry:
- Axios automatically POSTs `403` events to `/metrics/rbac`, which stores audit logs with `entityType=PERMISSION`.
- Aggregate metrics (last 7 days) available via `GET /metrics/summary`.
- QA route `/qa/rbac-check` renders a permission gate used by Playwright to assert student-facing restrictions without touching production flows.

These safeguards ensure every route stays permission-aware, any missing decorator fails CI, and operators can monitor RBAC denials over time.

---

## 🕹️ Gamification API

```bash
# Prisma migration
npx prisma migrate dev --name phase4_gamification_analytics

# Level seed
npx ts-node prisma/seed/levels.seed.ts

# Add XP event (teacher/director)
POST /gamification/xp
{
  "membershipId": "me",
  "type": "TEST_COMPLETION",
  "value": 50,
  "description": "Test XYZ dokončen"
}

# Fetch player summary
GET /gamification/summary/me
```

- XP loguje tabulka `xp_events`, levely se řídí referencí `levels`.
- Achievements se ukládají v `membership_achievements` a zobrazují na dashboardu.

## 📊 Analytics API

```bash
# Fire-and-forget log
POST /analytics/log
{
  "category": "navigation",
  "action": "page_view",
  "metadata": { "path": "/dashboard/tests" }
}

# Directors see summary
GET /analytics/summary?days=7
```

- Události se ukládají do `analytics_events`.
- Souhrn vrací top kombinace category/action za posledních N dní (default 7).

## 🧠 Future Enhancements

- Gamification system (XP, badges, progress levels)
- Adaptive learning recommendations
- Advanced analytics & reporting dashboards
- Integration with school systems (SSO, data sync)
- Accessibility & responsive optimization

---

## 👥 Project Team

| Role | Name | Responsibility |
|------|------|----------------|
| Lead Developer | Tomáš Kadleček | Full-stack architecture, implementation |
| Backend Support | — | API, Prisma, RBAC |
| Frontend UI | — | Next.js interface |
| QA & Testing | — | E2E verification, CI/CD checks |

---

## 🧩 License

MIT License — this project is developed as part of a Bachelor Thesis
at the University of Hradec Králové (Faculty of Informatics and Management).

---

## 🧠 Codex / Cursor Context Instructions

For AI assistants (Codex, Cursor, Copilot):
- Use this README as context for understanding the project architecture.
- Maintain consistency with the technologies and folder structure above.
- Respect the MVP module breakdown and completion percentages.
- Generate code compliant with TypeScript strict mode.
- Use NestJS dependency injection and DTO validation patterns.
- Prefer functional React components with TailwindCSS.
- When uncertain, output proposal + rationale before modifying code.
- Treat “SkillStorm” as an educational MVP — not a production product.

---

✅ This README has:
- Professional **GitHub-ready style**  
- Clear **architecture for AI and humans**  
- Everything required for a **bachelor thesis project**  
- A solid **master prompt** for Codex/Cursor
