import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../../..');
const readRepo = (path: string) => readFileSync(resolve(repoRoot, path), 'utf8');

describe('production backup operations contract', () => {
  const backupScript = 'scripts/ops/backup-production.sh';
  const freshnessScript = 'scripts/ops/check-backup-freshness.sh';

  it('keeps both operational scripts valid bash', () => {
    for (const relativePath of [backupScript, freshnessScript]) {
      expect(() =>
        execFileSync('bash', ['-n', resolve(repoRoot, relativePath)], {
          stdio: 'pipe',
        }),
      ).not.toThrow();
    }
  });

  it('requires off-host storage and alerting before a production backup can succeed', () => {
    const script = readRepo(backupScript);
    for (const variable of [
      'DATABASE_URL',
      'BACKUP_S3_ENDPOINT',
      'BACKUP_S3_BUCKET',
      'BACKUP_S3_REGION',
      'BACKUP_S3_ACCESS_KEY_ID',
      'BACKUP_S3_SECRET_ACCESS_KEY',
      'BACKUP_ALERT_WEBHOOK_URL',
    ]) {
      expect(script).toContain(variable);
    }
    expect(script).toContain('backup-db.sh');
    expect(script).toContain('--aws-sigv4');
    expect(script).toContain('--request PUT');
    expect(script).toContain('Content-Length');
    expect(script).toContain('remote checksum sidecar verification failed');
    expect(script).toContain('SUCCESS_EPOCH=');
    expect(script).toContain('REMOTE_DAILY_KEY=');
    expect(script).toContain('SHA256=');
    expect(script).toContain('skillstorm_backup_failed');
    expect(script).toContain("trap 'on_error");
  });

  it('checks freshness and remote integrity independently of the database', () => {
    const script = readRepo(freshnessScript);
    expect(script).toContain('BACKUP_MAX_AGE_HOURS');
    expect(script).toContain('--head');
    expect(script).toContain('REMOTE_DAILY_KEY.sha256');
    expect(script).toContain('EXPECTED_SHA');
    expect(script).toContain('skillstorm_backup_freshness_failed');
    expect(script).not.toContain('DATABASE_URL');
  });

  it('keeps backup execution isolated in an opt-in hardened compose overlay', () => {
    const compose = readRepo('docker-compose.backup.yml');
    expect(compose).toContain('backup:');
    expect(compose).toContain('backup-check:');
    expect(compose).toContain('profiles: ["ops"]');
    expect(compose).toContain('backupdata:/backups');
    expect(compose).toContain('BACKUP_S3_ENDPOINT');
    expect(compose).toContain('BACKUP_ALERT_WEBHOOK_URL');
    expect(compose).toContain('read_only: true');
    expect(compose).toContain('no-new-privileges:true');
    expect(compose).toContain('cap_drop:');

    const backupSection = compose.split('  backup-check:')[0] ?? '';
    expect(backupSection).toContain('- internal');
    expect(backupSection).toContain('- public');
    expect(compose).not.toMatch(/^\s*ports:/m);
  });

  it('builds the backup runner from PostgreSQL 15 and refuses curl without SigV4', () => {
    const dockerfile = readRepo('ops/backup/Dockerfile');
    expect(dockerfile).toContain('FROM postgres:15-alpine');
    expect(dockerfile).toContain('curl');
    expect(dockerfile).toContain('nodejs');
    expect(dockerfile).toContain('perl');
    expect(dockerfile).toContain("grep -q -- '--aws-sigv4'");
    expect(dockerfile).toContain('backup-production.sh');
  });

  it('schedules daily backup and hourly freshness checks persistently', () => {
    const backupService = readRepo(
      'ops/backup/systemd/skillstorm-backup.service',
    );
    const backupTimer = readRepo('ops/backup/systemd/skillstorm-backup.timer');
    const freshnessService = readRepo(
      'ops/backup/systemd/skillstorm-backup-freshness.service',
    );
    const freshnessTimer = readRepo(
      'ops/backup/systemd/skillstorm-backup-freshness.timer',
    );

    for (const service of [backupService, freshnessService]) {
      expect(service).toContain('-f docker-compose.prod.yml');
      expect(service).toContain('-f docker-compose.backup.yml');
      expect(service).toContain('--env-file /etc/skillstorm/production.env');
      expect(service).toContain('UMask=0077');
    }
    expect(backupService).toContain('run --rm backup');
    expect(freshnessService).toContain('run --rm backup-check');
    expect(backupTimer).toContain('OnCalendar=*-*-* 02:15:00');
    expect(backupTimer).toContain('Persistent=true');
    expect(freshnessTimer).toContain('OnCalendar=hourly');
    expect(freshnessTimer).toContain('Persistent=true');
  });
});
