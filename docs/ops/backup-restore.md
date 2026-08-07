# SkillStorm — Database Backup & Restore Runbook

> **Status:** `CURRENT / RUNBOOK`  
> **Owner:** Engineering + Operations  
> **Last verified:** 2026-08-07  
> **Scope:** logical PostgreSQL backups created by `scripts/ops/backup-db.sh`, safe restore through `scripts/ops/restore-db.sh`, and restore drills  
> **Executable authority:** the scripts referenced below are the operational source of truth. If a command or safety invariant changes in a script, update this runbook in the same PR.

---

## 0. Non-negotiable rules

1. **A backup that has never been restored is not a proven backup.**
2. **Never test a restore by overwriting the only production database.** Restore into a separate `*_test` database first.
3. **Logical dumps must exist outside the database host/provider.** A dump stored only beside the source database does not protect against account, host or provider loss.
4. **Managed-provider PITR is supplemental.** Verify current provider retention and recovery terms directly before relying on them; do not encode volatile pricing/retention assumptions in this runbook.
5. **Production restore is a controlled incident operation.** Stop or isolate application writers before destructive recovery and record the decision/audit trail.
6. **Never put production credentials or secrets into shell history, Markdown, tickets or screenshots.** Prefer a protected environment/secret manager.

---

# 1. Tooling

Repository scripts:

```text
scripts/ops/backup-db.sh
scripts/ops/restore-db.sh
scripts/ops/restore-drill.sh
```

Required PostgreSQL client tools depend on the operation:

```text
pg_dump
pg_restore
psql
createdb / dropdb    # restore drill
```

Use a client version compatible with the target PostgreSQL server. A restore drill is the final compatibility proof.

---

# 2. Backup creation

`backup-db.sh` requires `DATABASE_URL` and refuses to guess the source database.

Example for a local/non-production environment:

```bash
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/skillstorm' \
  scripts/ops/backup-db.sh
```

Do not copy this local example into production unchanged.

## Output contract

The script derives the database name from `DATABASE_URL` and creates:

```text
$BACKUP_DIR/daily/<dbname>_YYYYMMDD_HHMMSS.dump
$BACKUP_DIR/daily/<dbname>_YYYYMMDD_HHMMSS.dump.sha256
```

Default `BACKUP_DIR`:

```text
./backups
```

The dump uses PostgreSQL custom format and is restored with `pg_restore`.

Current script retention:

- last **7 daily** dumps;
- last **4 weekly** dumps;
- weekly copy on Sunday or when the newest weekly backup is older than the script's threshold.

Retention in this script is a local operational baseline, not a legal/data-retention policy. Production retention must also satisfy the project's privacy, incident-recovery and contractual requirements.

---

# 3. Off-host copy

After a successful local dump, copy encrypted backup material to storage independent of the database host/provider.

Acceptable production patterns include an appropriately secured object store or a separate controlled backup host.

Minimum requirements:

- encryption in transit;
- encryption at rest;
- access limited to the recovery role/team;
- deletion/retention controls;
- integrity metadata preserved (`.sha256` beside the dump);
- restore credentials not embedded inside the dump filename or documentation;
- periodic proof that the off-host copy is actually retrievable.

A successful `pg_dump` alone does not prove the external copy exists.

---

# 4. Scheduled backups

A production scheduler may invoke the backup script daily, for example:

```cron
0 2 * * * cd /srv/skillstorm && DATABASE_URL='<from protected runtime environment>' BACKUP_DIR=/var/backups/skillstorm scripts/ops/backup-db.sh >> /var/log/skillstorm-backup.log 2>&1
```

The exact path, scheduler and credential injection mechanism are deployment-specific.

### Required monitoring

The scheduler must produce an observable failure signal. At minimum monitor:

- last successful backup timestamp;
- dump file age;
- non-zero script exit;
- off-host-copy success;
- available backup storage capacity.

A cron entry with no alerting is not a sufficient production backup system.

---

# 5. Restore — safest path

## Step 1 — identify the intended dump

```bash
ls -lt backups/daily/ backups/weekly/
```

Choose the recovery point based on the incident. Do not automatically assume the newest backup is clean if the incident may have corrupted data earlier.

## Step 2 — verify integrity

`restore-db.sh` automatically checks a neighboring `.sha256` file when present.

Manual verification:

```bash
cd backups/daily
shasum -a 256 -c <dbname>_YYYYMMDD_HHMMSS.dump.sha256
```

If the checksum fails, do not restore that dump.

If the checksum file is missing, `restore-db.sh` currently warns and continues. For production recovery, treat a missing checksum as a degraded-confidence backup and prefer a verified copy when available.

## Step 3 — restore into a disposable database

Example:

```bash
scripts/ops/restore-db.sh \
  --file backups/daily/skillstorm_YYYYMMDD_HHMMSS.dump \
  --target-db skillstorm_restore_test \
  --recreate
```

Admin connection uses standard libpq environment variables:

```text
PGHOST       default localhost
PGPORT       default 5432
PGUSER       default postgres
PGPASSWORD   if required
```

### Safety behavior

A target whose name ends in `_test` can be restored non-interactively.

A target that does **not** end in `_test` requires an interactive confirmation where the operator retypes the exact target database name. The current script intentionally provides no bypass flag.

Do not weaken this control merely for automation convenience.

---

# 6. Validate the restored database

A successful `pg_restore` proves that PostgreSQL accepted the dump. It does not prove the application is healthy or that the data represents the intended recovery point.

Validate at least:

### Database integrity

- expected schema/tables exist;
- Prisma migration history is internally consistent;
- core tenant data is present;
- no obvious orphan relationships exist;
- expected recent records match the chosen recovery point.

### Application smoke test

Run the application against the **restored test database** using the normal local/test environment contract from `.env.example` and override only the recovery database URL/port as needed.

Conceptual example:

```bash
cd server
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/skillstorm_restore_test' \
PORT=4250 \
npm run start
```

The rest of the required local environment must already be configured safely; this runbook deliberately does not publish reusable secret values.

Then verify, using an account known to exist at the selected recovery point:

- `/health` responds successfully;
- authentication works;
- an authenticated tenant-scoped read returns expected data;
- critical school/class/content data can be read without server errors.

For an incident involving a specific feature, add a feature-specific smoke check before accepting the restore.

---

# 7. Restore drill

Run periodic recovery exercises with:

```bash
PGHOST=localhost \
PGPORT=5432 \
PGUSER=postgres \
PGPASSWORD='<local/admin password if required>' \
scripts/ops/restore-drill.sh
```

Optional arguments supported by the current script:

```text
--file <path.dump>   use a specific dump
--keep               leave the temporary drill DB for manual inspection
```

The drill currently checks, among other things:

- checksum when present;
- backup age;
- `pg_restore` errors;
- presence of a non-trivial schema;
- presence of core data;
- orphan membership integrity;
- unfinished Prisma migrations.

### Cadence

Minimum operational baseline:

- monthly restore drill;
- after material changes to backup/restore scripts;
- after PostgreSQL major-version or hosting changes;
- after schema/migration changes that materially affect recovery behavior.

A failed restore drill is an operational blocker until the recovery path is understood and corrected.

---

# 8. Production recovery procedure

Do not jump directly from “database incident” to destructive restore.

Recommended sequence:

```text
1. Declare/record incident and owner
2. Stop or isolate application writers if data may still be changing
3. Preserve current database/state where possible for forensics
4. Identify incident start and candidate recovery point
5. Retrieve independent backup copy
6. Verify checksum
7. Restore to *_test
8. Run DB + application smoke tests
9. Decide recovery method
10. Create/verify a final pre-change snapshot if safe
11. Perform controlled production restore/switchover
12. Run production smoke tests
13. Re-enable traffic/writers deliberately
14. Monitor errors, data integrity and queues/jobs
15. Record recovery point, commands, actors and outcome
16. Conduct post-incident review
```

If a managed database provider offers point-in-time recovery, compare PITR and logical-dump options for the specific incident. Neither is universally better.

---

# 9. Restoring into a non-test target

Only after a verified test restore and an explicit incident decision should an operator target a non-`*_test` database.

Example shape:

```bash
scripts/ops/restore-db.sh \
  --file <verified-dump> \
  --target-db <production-database-name> \
  --recreate
```

The script requires interactive retyping of the target database name.

Before executing:

```text
[ ] exact target environment confirmed
[ ] writers/traffic strategy decided
[ ] selected dump checksum verified
[ ] test restore passed
[ ] application smoke test passed against test restore
[ ] current-state preservation considered/performed
[ ] incident owner authorizes destructive step
[ ] rollback/fallback documented
```

---

# 10. Migration compatibility after recovery

A historical backup can be older than the currently deployed application schema.

Do not point new application code at the restored database and assume compatibility.

If the recovery strategy keeps the current application release, determine whether forward migrations are required:

```bash
cd server
DATABASE_URL='<restored target URL>' npx prisma migrate deploy
```

Run migrations only after verifying the intended recovery strategy and preserving the raw restored state where appropriate.

If forward migration changes data irreversibly, keep the untouched restored copy until validation is complete.

---

# 11. Common failure cases

## `pg_restore` fails against a non-empty schema

Use the tested `restore-db.sh` path and `--recreate` only for the intended disposable/authorized target.

## Database cannot be dropped because sessions are active

Stop clients/application connections. The restore script uses PostgreSQL forced drop behavior where supported, but permissions and server version still matter.

## Checksum mismatch

Treat the dump as corrupted. Retrieve another independent copy/recovery point and investigate storage or transfer integrity.

## Restored application cannot start

Check, in order:

- application logs;
- environment contract;
- schema/migration level;
- target database URL;
- required external dependencies;
- whether the restored backup predates a breaking migration/application change.

## Backup is older than expected

Treat this as a monitoring/scheduler failure, not merely an old file. Determine why scheduled backup/off-host copy stopped succeeding.

---

# 12. Backup evidence

Production operations should be able to answer:

```text
When was the last successful backup?
Where is the independent copy?
What is its checksum?
When was that backup path last restored successfully?
Which schema/application version was used in the drill?
Who can perform a production recovery?
```

If these answers require guesswork, backup readiness is incomplete.

---

# 13. Runbook change gate

Any change to backup/restore behavior must update and verify together:

```text
[ ] scripts/ops/backup-db.sh
[ ] scripts/ops/restore-db.sh
[ ] scripts/ops/restore-drill.sh where relevant
[ ] this runbook
[ ] monitoring/scheduler configuration where relevant
[ ] at least one fresh backup
[ ] at least one successful restore drill
```

---

## Final invariant

> **A SkillStorm backup is considered operationally trustworthy only when it is independently stored, integrity-verifiable, monitored for freshness, and periodically restored into a clean environment with application-level validation.**