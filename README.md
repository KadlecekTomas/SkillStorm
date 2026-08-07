# Eduto

Webová vzdělávací platforma pro školy.

## Product vision

- [SkillStorm Interactive Curriculum](./docs/interactive-curriculum/README.md) — nadřazená vize interaktivní výuky napříč předměty: `BOARD_ONLY`, `SHARED_DEVICES`, `DEVICES`, `HYBRID`, předmětové enginy, Teacher Orchestration a realistické fungování i ve škole s jedinou interaktivní tabulí.
- [Interactive Curriculum — Master Use Cases](./docs/interactive-curriculum/USE-CASES.md) — detailní překlad vize do reálných hodin 1.–9. ročníku: předmětové use cases, hero lessons, teacher workflows, learning evidence, SVP/accessibility, coverage gates a rollout.
- [School Curriculum Coverage & ŠVP Integration](./docs/interactive-curriculum/SCHOOL-CURRICULUM-COVERAGE.md) — celková mapa všech 10 vzdělávacích oblastí RVP ZV, předmětových experience families, curriculum versioningu, importu ŠVP, `covered / partial / missing` auditu a curriculum-aware teacher UX.
- [Audio & Language Learning Engine](./docs/interactive-curriculum/AUDIO-LANGUAGE-ENGINE.md) — detailní audio-first blueprint: kurátorované zvukové vzory, timed text, poslechové primitives, privacy/QA/architecture a doporučená cesta českého jazyka od 1. do 9. ročníku.
- [SkillStorm Interactive IT Lab](./docs/interactive-it-lab/README.md) — první subject blueprint: cílová vize interaktivní výuky informatiky pro celou třídu, Activity Engine, Build-a-PC showcase, adaptivní obtížnost, Teacher Mission Control a práce s interaktivní tabulí.
- [Live Sessions](./docs/live-sessions.md) — současný koncept a implementační kontrakty Bleskovek.
- [Live Sessions — interactive rounds](./docs/live-sessions-interactions.md) — současné drag & drop interakce na tabuli.

## Spuštění přes Docker

### Požadavky

- Docker
- Docker Compose

### 1. Nastavení prostředí

V kořeni projektu vytvoř `.env` podle `.env.example`.

Nejmenší nutné minimum:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=eduto
POSTGRES_PORT=5432
JWT_SECRET=supersecret
PUBLIC_APP_URL=http://localhost:3000
API_URL=http://localhost:4200
```

### Rychlé spuštění dev stacku

Lokální služby jsou v Docker Compose schované pod profilem `dev`. Pro spuštění celého dev stacku proto použij:

```bash
docker compose --profile dev up --build
```

Samotné `docker compose up --build` nespouštěj; bez profilu Docker Compose nemá vybranou žádnou službu a skončí hláškou `no service selected`.

Kontrola běžících služeb:

```bash
docker compose --profile dev ps
```

URL po startu:

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend health: [http://localhost:4200/health](http://localhost:4200/health)

### 2. Spuštění databáze a Redis

```bash
docker compose --profile dev up -d postgres redis
```

### 3. Inicializace databáze a seed dat

```bash
docker compose --profile dev run --rm seed-full
```

Tento krok provede migrace a naplní databázi ukázkovými daty.

### 4. Spuštění backendu a frontendu

```bash
docker compose --profile dev up -d backend frontend
```

### 5. Otevření aplikace

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend health: [http://localhost:4200/health](http://localhost:4200/health)

### 6. Ukončení aplikace

```bash
docker compose --profile dev down
```

Nepoužívejte `down -v`, pokud nechcete smazat databázová volume. Pokud chcete odstranit i databázový volume:

```bash
docker compose --profile dev down -v
```

## Poznámky

- `seed-full` je jednorázová služba definovaná v [docker-compose.yml](/Users/tomaskadlecek/Documents/GitHub/Eduto/docker-compose.yml).
- Backend běží na portu `4200`, frontend na portu `3000`.
- Pokud seed nebo start selže, nejdřív ověřte obsah `.env` a dostupnost Docker daemonu.
