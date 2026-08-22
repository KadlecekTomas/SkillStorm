# SkillStorm production backup operations

This directory is the deployable production implementation of the backup requirements in [`docs/ops/backup-restore.md`](../../docs/ops/backup-restore.md).

It does not replace the existing restore runbook. It adds the missing production path from a verified local `pg_dump` to independent S3-compatible storage, plus freshness monitoring and failure alerting.

## Guarantees

A successful `backup` run means all of the following completed:

1. `scripts/ops/backup-db.sh` created a PostgreSQL custom-format dump and SHA-256 sidecar.
2. The local SHA-256 sidecar was verified.
3. The dump and checksum were uploaded to independent S3-compatible storage.
4. The remote dump was re-read with `HEAD` and its byte length matched the local dump.
5. The remote checksum sidecar was downloaded and matched the local SHA-256 value.
6. Only then was the persistent `last-success` freshness marker updated.

`backup-check` independently verifies that the marker is recent, the remote dump is readable and the remote checksum sidecar still matches. A failure exits non-zero and sends a webhook alert.

## Supported object storage

The uploader uses S3 Signature V4 through `curl`, so it is provider-neutral across S3-compatible storage such as AWS S3, Cloudflare R2, Backblaze B2 S3 API and compatible self-hosted object stores.

Provider setup, credentials, bucket lifecycle rules and account-level MFA are deployment concerns. Do not commit those credentials to this repository.

## Required production environment

Set these in `/etc/skillstorm/production.env` or the equivalent protected secret source:

```text
PROD_BACKUP_S3_ENDPOINT
PROD_BACKUP_S3_BUCKET
PROD_BACKUP_S3_REGION
PROD_BACKUP_S3_ACCESS_KEY_ID
PROD_BACKUP_S3_SECRET_ACCESS_KEY
PROD_BACKUP_ALERT_WEBHOOK_URL
```

Optional:

```text
PROD_BACKUP_S3_PREFIX=skillstorm/production
PROD_BACKUP_MAX_AGE_HOURS=30
```

`PROD_DATABASE_URL` is already part of the normal production environment and is consumed only by the `backup` job. `backup-check` does not receive database credentials.

The alert endpoint must accept a generic JSON object shaped as:

```json
{"event":"skillstorm_backup_failed","text":"non-secret operational message"}
```

or the analogous `skillstorm_backup_freshness_failed` event. Alert payloads never include database URLs, object-storage credentials, dumps or application secrets.

## One-shot verification before enabling timers

From the production checkout:

```bash
docker compose \
  --env-file /etc/skillstorm/production.env \
  -f docker-compose.prod.yml \
  -f docker-compose.backup.yml \
  --profile ops \
  run --rm backup
```

Then run the independent check:

```bash
docker compose \
  --env-file /etc/skillstorm/production.env \
  -f docker-compose.prod.yml \
  -f docker-compose.backup.yml \
  --profile ops \
  run --rm backup-check
```

Do not enable scheduling until both commands succeed against the real production database and real independent bucket.

## systemd installation

The checked-in units assume:

```text
repository:       /srv/skillstorm
production env:  /etc/skillstorm/production.env
Docker CLI:      /usr/bin/docker
```

Install as root:

```bash
install -m 0644 ops/backup/systemd/skillstorm-backup.service /etc/systemd/system/
install -m 0644 ops/backup/systemd/skillstorm-backup.timer /etc/systemd/system/
install -m 0644 ops/backup/systemd/skillstorm-backup-freshness.service /etc/systemd/system/
install -m 0644 ops/backup/systemd/skillstorm-backup-freshness.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now skillstorm-backup.timer
systemctl enable --now skillstorm-backup-freshness.timer
```

The backup timer runs daily around 02:15 with randomized delay. The freshness checker runs hourly. Both use `Persistent=true`, so a missed timer caused by host downtime is handled when the host returns.

Inspect state with:

```bash
systemctl list-timers 'skillstorm-backup*'
systemctl status skillstorm-backup.service
systemctl status skillstorm-backup-freshness.service
journalctl -u skillstorm-backup.service
journalctl -u skillstorm-backup-freshness.service
```

## Recovery proof

Off-host upload is not the final recovery proof. Periodically retrieve a remote `.dump` and `.sha256` using an operator-controlled authenticated path, place them together in a protected local directory, then run the existing restore drill from [`docs/ops/backup-restore.md`](../../docs/ops/backup-restore.md).

Production readiness requires evidence of all four layers:

```text
scheduled backup succeeds
→ independent remote copy verifies
→ freshness alerting is observable
→ a remote-retrieved dump restores successfully
```

The repository provides the mechanism. A production deployment is not certified until real storage credentials/webhook/timers are configured and a real remote-retrieval restore drill has succeeded.
