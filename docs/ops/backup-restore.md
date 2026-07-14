# Zálohy a obnova databáze — runbook

> Psáno pro čtení ve stresu. Postupuj shora dolů, nic nepřeskakuj.
> Všechny příkazy se spouštějí z kořene repozitáře.

## TL;DR obnova (disaster recovery)

```bash
# 1. Najdi nejnovější zálohu
ls -lt backups/daily/ | head

# 2. Obnov ji do NOVÉ databáze (nikdy nepřepisuj původní, dokud si nejsi jistý)
scripts/ops/restore-db.sh \
  --file backups/daily/skillstorm_YYYYMMDD_HHMMSS.dump \
  --target-db skillstorm_restore_test --recreate

# 3. Ověř obnovená data smoke testem (sekce „Smoke test" níže)

# 4. Teprve po úspěšném smoke testu přepni aplikaci na obnovenou DB,
#    NEBO obnov do produkčního názvu (vyžádá si interaktivní potvrzení):
scripts/ops/restore-db.sh --file <dump> --target-db skillstorm --recreate
```

## Jak fungují zálohy

- Skript: `scripts/ops/backup-db.sh`
- Formát: `pg_dump --format=custom` (komprimovaný, obnovitelný přes `pg_restore`)
- Umístění: `$BACKUP_DIR/daily/` a `$BACKUP_DIR/weekly/` (výchozí `./backups`)
- Název: `<dbname>_YYYYMMDD_HHMMSS.dump` + `.sha256` checksum
- Rotace: **7 denních + 4 týdenní** (týdenní se pořizuje v neděli, nebo když
  je nejnovější týdenní starší než 6 dní)

Ruční spuštění zálohy:

```bash
DATABASE_URL='postgresql://postgres:postgres@localhost:5433/skillstorm' \
  scripts/ops/backup-db.sh
```

Doporučený cron (denně ve 2:00, viz `crontab -e` na serveru):

```cron
0 2 * * * cd /path/to/SkillStorm && DATABASE_URL='<produkční URL>' BACKUP_DIR=/var/backups/skillstorm scripts/ops/backup-db.sh >> /var/log/skillstorm-backup.log 2>&1
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
   scripts/ops/restore-db.sh --file <dump> --target-db skillstorm_restore_test --recreate
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
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/skillstorm_restore_test' \
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
