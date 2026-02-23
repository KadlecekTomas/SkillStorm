/* eslint-disable @typescript-eslint/no-var-requires */
// CommonJS, ne ESM!
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// VŽDY načti .env.test (ne .env)
const dotenvPath = path.resolve(__dirname, '..', '.env.test');
if (fs.existsSync(dotenvPath)) {
  dotenv.config({ path: dotenvPath });
}

// Pokud chybí schema=, vytvoř izolované schema pro každý běh testu
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('schema=')) {
  const url = new URL(process.env.DATABASE_URL);
  const schema = `e2e_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
}

// NEPŘIDÁVEJ ?schema=...  – nech tak, jak je v .env.test
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL není nastavená (načítej z .env.test).');
}

// Bezpečné test flagem
process.env.NODE_ENV = 'test';
process.env.DISABLE_STATS_CACHE = process.env.DISABLE_STATS_CACHE || '1';
process.env.DISABLE_CSRF = process.env.DISABLE_CSRF || '1';
process.env.DISABLE_THROTTLE = process.env.DISABLE_THROTTLE || '1';
process.env.PORT = process.env.PORT || '0';
process.env.CACHE_TTL_SECONDS = process.env.CACHE_TTL_SECONDS || '0';

// (volitelné) konzistentní časová zóna pro snapshoty/daty
process.env.TZ = process.env.TZ || 'UTC';
