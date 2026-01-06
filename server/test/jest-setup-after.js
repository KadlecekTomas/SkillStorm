/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const Test = require('supertest/lib/test');

const originalAssert = Test.prototype.assert;
Test.prototype.assert = function (err, res, fn) {
  if (
    res &&
    res.body &&
    res.body.success === true &&
    Object.prototype.hasOwnProperty.call(res.body, 'data')
  ) {
    const data = res.body.data;
    res.body = data;
    try {
      if (Array.isArray(res.body)) {
        res.body.data = res.body;
      }
      res.body._envelope = { success: true, data };
    } catch (_) {
      // Ignore if body is immutable.
    }
  }
  return originalAssert.call(this, err, res, fn);
};

async function setupDb() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL není nastavená');

  const url = new URL(dbUrl);
  const schema = url.searchParams.get('schema');
  if (!schema) throw new Error('DATABASE_URL nemá ?schema=');

  const base = dbUrl.replace(/(\?|&)schema=[^&]+/, '').replace(/[?&]$/, '');
  const prisma = new PrismaClient({ datasources: { db: { url: base } } });
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await prisma.$disconnect();

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: process.env,
    cwd: require('path').resolve(__dirname, '..'),
  });
}

setupDb().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[jest-setup-after] DB init failed', err);
  process.exit(1);
});

module.exports = setupDb;
