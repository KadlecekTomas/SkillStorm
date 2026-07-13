/* eslint-disable @typescript-eslint/no-var-requires */
const { resolveTestDatabaseUrl } = require('./resolve-test-db-url');

module.exports = async () => {
  // Resolve the test DB exclusively via DATABASE_URL_TEST. The ambient
  // DATABASE_URL is never used here: this runs in Jest's MAIN process, where
  // requiring @prisma/client auto-loads server/.env — trusting it would point
  // the destructive cleanup at the dev database.
  const src = resolveTestDatabaseUrl();
  if (!src) return;
  const { PrismaClient } = require('@prisma/client');
  const base = src.replace(/(\?|&)schema=[^&]+/, '').replace(/[?&]$/, '');
  const prisma = new PrismaClient({ datasources: { db: { url: base } } });
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name LIKE 'test_%'
    `);
    for (const r of rows) {
      const name = r.schema_name || r.schema || r.SCHEMA_NAME;
      if (name) {
        await prisma
          .$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${name}" CASCADE`)
          .catch(() => {});
      }
    }
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
};
