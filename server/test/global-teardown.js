import { PrismaClient } from '@prisma/client';

export default async () => {
  const src = process.env.DATABASE_URL || process.env.BASE_DATABASE_URL;
  if (!src) return;
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
