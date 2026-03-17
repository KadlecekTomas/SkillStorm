# SkillStorm

SkillStorm je webová aplikace pro správu školních testů, zadání, odevzdání a základní analytiky.
Repozitář je rozdělený na frontend (`client`) a backend (`server`).

## Struktura projektu

- `client` – frontend v Next.js
- `server` – backend API v NestJS + Prisma
- `docs` – doplňující dokumentace

## Použité technologie

- Next.js 15
- React 19
- NestJS
- Prisma ORM
- PostgreSQL
- Redis (volitelné lokálně, doporučené pro cache)

## Požadavky

- Node.js 20+
- npm
- PostgreSQL
- volitelně Redis

## Rychlé spuštění

### 1. Instalace závislostí

```bash
cd client
npm install

cd ../server
npm install
```

### 2. Konfigurace prostředí

Projekt používá `.env` soubory.

Minimálně je potřeba nastavit backend:

- `DATABASE_URL`
- `JWT_SECRET`

Další proměnné lze doplnit podle `.env.example` v rootu projektu a podle lokální konfigurace.

### 3. Databáze

Po nastavení databáze spusť migrace:

```bash
cd server
npx prisma migrate deploy
```

Volitelně lze naplnit demo data:

```bash
cd server
npm run seed:demo
```

### 4. Start backendu

```bash
cd server
npm run start:dev
```

Backend standardně běží na:

- `http://localhost:4200`

### 5. Start frontendu

V novém terminálu:

```bash
cd client
npm run dev
```

Frontend standardně běží na:

- `http://localhost:3000`

## Docker varianta

V repozitáři je připravený [docker-compose.yml](./docker-compose.yml).

Pro lokální databázi stačí typicky spustit:

```bash
docker compose up -d postgres
```

Případně lze spouštět i další služby definované v compose souboru.

## Užitečné příkazy

Frontend:

```bash
cd client
npm run typecheck
npm run test:unit
```

Backend:

```bash
cd server
npm run typecheck
npm test
```

## Poznámky

- Pro plnou funkčnost je potřeba běžící backend i frontend současně.
- Projekt je rozvíjen jako školní / akademický software prototyp.
- Další technické detaily jsou v podsložkách `client`, `server` a `docs`.
