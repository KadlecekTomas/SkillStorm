# SkillStorm

Webová vzdělávací platforma pro školy.

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
POSTGRES_DB=skillstorm
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

- `seed-full` je jednorázová služba definovaná v [docker-compose.yml](/Users/tomaskadlecek/Documents/GitHub/SkillStorm/docker-compose.yml).
- Backend běží na portu `4200`, frontend na portu `3000`.
- Pokud seed nebo start selže, nejdřív ověřte obsah `.env` a dostupnost Docker daemonu.
