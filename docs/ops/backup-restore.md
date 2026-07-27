# Zálohy a obnova databáze — runbook

> Psáno pro čtení ve stresu. Postupuj shora dolů, nic nepřeskakuj.
> Všechny příkazy se spouštějí z kořene repozitáře.

## TL;DR obnova (disaster recovery)

```bash
# 1. Najdi nejnovější zálohu
ls -lt backups/daily/ | head

# 2. Obnov ji do NOVÉ databáze (nikdy nepřepisuj původní, dokud si nejsi jistý)
scripts/ops/restore-db.sh \
  --file backups/daily/eduto_YYYYMMDD_HHMMSS.dump \
  --target-db eduto_restore_test --recreate

# 3. Ověř obnovená data smoke testem (sekce „Smoke test" níže)

# 4. Teprve po úspěšném smoke testu přepni aplikaci na obnovenou DB,
#    NEBO obnov do produkčního názvu (vyžádá si interaktivní potvrzení):
scripts/ops/restore-db.sh --file <dump> --target-db eduto --recreate
```

## Co dělá Render a co si musíš zařídit sám

Ověřeno v dokumentaci Renderu 27. 7. 2026 — před spuštěním produkce si to
potvrď v jejich UI, ceníky a limity se mění.

| | Free | Hobby (placený) | Pro a výš |
|---|---|---|---|
| Point-in-time recovery | **není** | posledních **3 dny** | posledních **7 dní** |
| Logické zálohy (export) | **nevytváří se** | ruční export z dashboardu | ruční export z dashboardu |
| Retence logických záloh | — | 7 dní od vytvoření | 7 dní od vytvoření |
| Automatická denní záloha | **ne** | **ne** | **ne** |

Tři věci, které z toho plynou a které se snadno přehlédnou:

1. **Render nedělá automatické logické zálohy na žádném plánu.** PITR je
   něco jiného — obnovuje instanci do bodu v čase, ale je vázaný na běžící
   instanci. Když ti někdo smaže instanci nebo vyprší platba, PITR ti
   nepomůže. Vlastní dumpy přes `backup-db.sh` jsou proto povinné, ne
   doplňkové.
2. **Free Postgres vyprší 30 dní po vytvoření** a po dalších 14 dnech
   Render databázi i s daty smaže. Limit 1 GB, žádné zálohy. Pro data žáků
   je Free instance vyloučená.
3. **Retence 7 dní u logických záloh je krátká.** Chyba, kterou nikdo
   nezpozoruje do týdne (například tichý mazací skript), přežije celé
   Render okno. Vlastní dumpy s rotací 7 denních + 4 týdenní jsou to,
   co takový případ pokrývá.

**Dělitelnost odpovědnosti:**

- *Render:* PITR na placeném plánu, dostupnost instance, ruční export z UI.
- *Ty:* denní `backup-db.sh` z cronu, odvoz dumpů mimo Render (S3/rsync),
  měsíční cvičení obnovy, hlídání, že cron opravdu běží.

## Nanečisto obnova (restore drill)

Záloha, kterou jsi nikdy neobnovil, není záloha. Skript
`scripts/ops/restore-drill.sh` vezme poslední dump, obnoví ho do dočasné
databáze, ověří ho a po sobě uklidí. Nic produkčního nesahá.

```bash
PGHOST=localhost PGPORT=5433 PGUSER=postgres PGPASSWORD=postgres \
  scripts/ops/restore-drill.sh
```

Co kontroluje:

- SHA-256 checksum dumpu (poškozený dump budí falešný klid),
- že záloha není starší než 2 dny — tím se pozná, že cron přestal běhat,
- že `pg_restore` neskončil skutečnou chybou (verzní šum se ignoruje),
- že schéma má přes 20 tabulek a `users`, `organizations`, `memberships`
  nejsou prázdné — prázdná databáze by „obnovou" prošla taky,
- že nejsou osiřelá členství (obnova, která rozbije tenanty, je k ničemu),
- že v `_prisma_migrations` nezůstala nedokončená migrace.

Vrací nenulový kód při selhání, takže se dá pověsit do cronu jako měsíční
cvičení. `--keep` nechá obnovenou databázi k ručnímu prohlédnutí,
`--file` vybere konkrétní zálohu.

**Doporučená kadence:** jednou měsíčně a vždy po změně schématu, která
mění migrace.

## Jak fungují zálohy

- Skript: `scripts/ops/backup-db.sh`
- Formát: `pg_dump --format=custom` (komprimovaný, obnovitelný přes `pg_restore`)
- Umístění: `$BACKUP_DIR/daily/` a `$BACKUP_DIR/weekly/` (výchozí `./backups`)
- Název: `<dbname>_YYYYMMDD_HHMMSS.dump` + `.sha256` checksum
- Rotace: **7 denních + 4 týdenní** (týdenní se pořizuje v neděli, nebo když
  je nejnovější týdenní starší než 6 dní)

Ruční spuštění zálohy:

```bash
DATABASE_URL='postgresql://postgres:postgres@localhost:5433/eduto' \
  scripts/ops/backup-db.sh
```

Doporučený cron (denně ve 2:00, viz `crontab -e` na serveru):

```cron
0 2 * * * cd /path/to/Eduto && DATABASE_URL='<produkční URL>' BACKUP_DIR=/var/backups/skillstorm scripts/ops/backup-db.sh >> /var/log/skillstorm-backup.log 2>&1
```

> Zálohy ukládej mimo stroj s databází (rsync/S3 sync adresáře
> `$BACKUP_DIR`) — lokální disk není záloha.

## Obnova krok za krokem

1. **Zjisti, kterou zálohu chceš.** Denní pro běžnou havárii, týdenní pokud
   se problém (např. poškozená data) táhne déle.

   ```bash
   ls -lt backups/daily/ backups/weekly/
   ```

2. **Ověř checksum** (restore skript to dělá automaticky, ručně):

   ```bash
   cd backups/daily && shasum -a 256 -c <soubor>.dump.sha256
   ```

3. **Obnov do zkušební databáze** (`*_test` název → bez potvrzování):

   ```bash
   scripts/ops/restore-db.sh --file <dump> --target-db eduto_restore_test --recreate
   ```

   Connection na admin úrovni řídí standardní proměnné `PGHOST`, `PGPORT`,
   `PGUSER`, `PGPASSWORD` (výchozí `localhost:5432`, user `postgres`).

4. **Smoke test proti obnovené DB** (viz níže). Bez něj obnovu nepovažuj
   za úspěšnou — úspěšný `pg_restore` ověřuje jen formát, ne použitelnost.

5. **Přepnutí aplikace.** Buď uprav `DATABASE_URL` na obnovenou DB, nebo
   obnov do produkčního názvu — skript si vyžádá přepsání přesného názvu
   databáze (ochrana proti překlepu; nejde obejít flagem ani env).

## Smoke test obnovené databáze

```bash
cd server
# aplikaci spusť proti obnovené DB na vedlejším portu
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/eduto_restore_test' \
  PORT=4250 JWT_SECRET=dev DISABLE_CSRF=1 npm run start &

# počkej na health
npx wait-on -t 60000 http://localhost:4250/health

# 1) login (uprav e-mail/heslo podle reálného účtu v záloze)
curl -sf -X POST http://localhost:4250/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<účet>","password":"<heslo>"}' | head -c 300

# 2) autentizovaný dotaz (načtení testů) — použij accessToken z předchozí odpovědi
curl -sf http://localhost:4250/tests -H "Authorization: Bearer <token>" | head -c 300
```

Kritérium úspěchu: login vrátí token, autentizované čtení vrátí data
odpovídající době pořízení zálohy.

## Časté problémy

- **`pg_restore: error: could not execute query`** — obnovuješ do neprázdné
  DB se starým schématem. Použij `--recreate`.
- **`FATAL: database ... is being accessed by other users`** při
  `--recreate` — zastav aplikaci/klienty připojené k cílové DB (skript
  používá `DROP ... WITH (FORCE)`, ale superuser práva jsou potřeba).
- **Checksum nesedí** — záloha je poškozená; vezmi předchozí a eskaluj
  (zkontroluj disk / přenos).
- **Obnovená DB je za migracemi** (starší záloha, novější kód) — spusť
  `cd server && npx prisma migrate deploy` proti obnovené DB.
