import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regrese k nálezu: render.yaml pouštěl demo seed s NODE_ENV=production,
 * takže na nasazené instanci vznikaly účty director/teacher/student.demo
 * s heslem 'Password123!', které je natvrdo v public repu.
 *
 * Testy běží přes child proces se záměrně nedostupnou databází. Když guard
 * funguje, skript spadne DŘÍV, než se k databázi vůbec připojí — proto se
 * asserty dívají na text chyby, ne jen na exit kód. Bez guardu skript doběhne
 * až k Prisma chybě spojení, tedy s jinou zprávou, a test právem selže.
 */

const SERVER_ROOT = join(__dirname, '..', '..');

/** Databáze, ke které se nelze připojit — port 1 nikdy neposlouchá. */
const UNREACHABLE_DB = 'postgresql://nobody:nobody@127.0.0.1:1/nonexistent';

const BASE_ENV = {
  ...process.env,
  DATABASE_URL: UNREACHABLE_DB,
  SUPERADMIN_EMAIL: 'admin@example.test',
  SUPERADMIN_PASSWORD: 'aVeryStrongBootstrapPassword123',
  // jest-env nastavuje testovací vlajky, které by prod větev mátly
  APP_ENV: '',
};

function runSeed(
  command: string,
  args: string[],
  env: Record<string, string>,
): { status: number | null; output: string } {
  const result = spawnSync(command, args, {
    cwd: SERVER_ROOT,
    env: { ...BASE_ENV, ...env },
    encoding: 'utf8',
    timeout: 90_000,
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

describe('demo seed — produkční guard', () => {
  it('s NODE_ENV=production skončí chybou a nesáhne na databázi', () => {
    const { status, output } = runSeed('node', ['prisma/seed.js'], {
      NODE_ENV: 'production',
      DEMO_SEED: '1',
    });

    expect(status).not.toBe(0);
    expect(output).toContain('ALLOW_DEMO_SEED_IN_PRODUCTION');
    // Guard musí zabrat před připojením k DB, ne až po něm.
    expect(output).not.toMatch(/Can't reach database server|ECONNREFUSED/i);
  });

  it('s explicitním ALLOW_DEMO_SEED_IN_PRODUCTION=1 guard pustí dál', () => {
    const { output } = runSeed('node', ['prisma/seed.js'], {
      NODE_ENV: 'production',
      DEMO_SEED: '1',
      ALLOW_DEMO_SEED_IN_PRODUCTION: '1',
    });

    // Guard mlčí; skript pokračuje a padne až na nedostupné databázi.
    expect(output).not.toContain('ALLOW_DEMO_SEED_IN_PRODUCTION=1 to override');
    expect(output).toMatch(/Can't reach database server|ECONNREFUSED|P1001/i);
  });
});

describe('demo seed — heslo z prostředí', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runDemoSeed } = require('../../prisma/demo-seed') as {
    runDemoSeed: () => Promise<void>;
  };
  const ORIGINAL = process.env.DEMO_PASSWORD;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DEMO_PASSWORD;
    else process.env.DEMO_PASSWORD = ORIGINAL;
  });

  it('bez DEMO_PASSWORD odmítne běžet', async () => {
    delete process.env.DEMO_PASSWORD;
    await expect(runDemoSeed()).rejects.toThrow(/at least 16 characters/i);
  });

  it('krátké heslo odmítne — i to původní z repa', async () => {
    process.env.DEMO_PASSWORD = 'Password123!';
    await expect(runDemoSeed()).rejects.toThrow(/at least 16 characters/i);
  });

  it('zdrojový kód demo seedu neobsahuje heslo natvrdo', () => {
    const src = readFileSync(
      join(SERVER_ROOT, 'prisma', 'demo-seed.js'),
      'utf8',
    );
    // Přiřazení literálu do DEMO_PASSWORD se sem nesmí vrátit.
    expect(src).toMatch(/const DEMO_PASSWORD = process\.env\.DEMO_PASSWORD/);
    expect(src).not.toMatch(/const DEMO_PASSWORD = ['"][^'"]+['"]/);
  });
});

describe('seed:production — heslo pro ne-superadmin účty', () => {
  it('v produkci bez SEED_USER_PASSWORD spadne a nedosadí demo heslo', () => {
    const { status, output } = runSeed(
      'npx',
      ['ts-node', 'prisma/seed/full-production-seed.ts'],
      {
        NODE_ENV: 'production',
        SEED_USER_PASSWORD: '',
      },
    );

    expect(status).not.toBe(0);
    expect(output).toContain('SEED_USER_PASSWORD');
    expect(output).not.toMatch(/Can't reach database server|ECONNREFUSED/i);
  });
});
