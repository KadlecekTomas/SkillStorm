/**
 * Bezpečnostní guardy pro seed skripty.
 *
 * Proč to existuje: render.yaml pouštěl demo seed s NODE_ENV=production a na
 * nasazené instanci tím vznikaly účty s heslem, které je natvrdo v public repu.
 * Guardy jsou schválně v prostém CommonJS — `prisma db seed` spouští
 * `node prisma/seed.js`, takže je musí umět načíst i běh bez ts-node.
 *
 * Pravidlo: v produkci se nikdy nepoužije výchozí heslo. Když chybí konfigurace,
 * skript spadne. Tiché přeskočení by se v deploy logu ztratilo.
 */

/** Výchozí heslo demo účtů. Veřejně známé — smí žít jen mimo produkci. */
const DEMO_PASSWORD = 'Password123!';

function isProduction(env = process.env) {
  return env.NODE_ENV === 'production' || env.APP_ENV === 'production';
}

/**
 * Zastaví demo seed v produkci. Přebít lze jen vědomě přes
 * ALLOW_DEMO_SEED_IN_PRODUCTION=1 (například když někdo staví demo instanci
 * s NODE_ENV=production a rozumí tomu, že v ní budou veřejně známá hesla).
 */
function assertDemoSeedAllowed(env = process.env) {
  if (!isProduction(env)) return;
  if (env.ALLOW_DEMO_SEED_IN_PRODUCTION === '1') return;

  throw new Error(
    'Refusing to run the demo seed with NODE_ENV=production. ' +
      'It creates director/teacher/student accounts with a password that is ' +
      'hardcoded in the public repository. ' +
      'Set ALLOW_DEMO_SEED_IN_PRODUCTION=1 to override on a throwaway demo instance.',
  );
}

/**
 * Heslo pro ne-superadmin účty (ředitelé, učitelé, žáci) v seed skriptech.
 * V produkci musí přijít z env a nesmí to být demo heslo — jinak by seed
 * s produkčním jménem zakládal účty s veřejně známým přístupem.
 */
function resolveSeedUserPassword(env = process.env) {
  const fromEnv = (env.SEED_USER_PASSWORD ?? '').trim();

  if (!isProduction(env)) {
    return fromEnv || DEMO_PASSWORD;
  }

  if (!fromEnv) {
    throw new Error(
      'SEED_USER_PASSWORD is required when NODE_ENV=production. ' +
        'Seeded directors, teachers and students would otherwise get the ' +
        'public demo password.',
    );
  }

  if (fromEnv === DEMO_PASSWORD) {
    throw new Error(
      'SEED_USER_PASSWORD must not be the public demo password in production.',
    );
  }

  return fromEnv;
}

module.exports = {
  DEMO_PASSWORD,
  isProduction,
  assertDemoSeedAllowed,
  resolveSeedUserPassword,
};
