// test/utils/reset-db.ts (TS)
import { PrismaClient } from '@prisma/client';
export async function resetDb(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    DO $$ DECLARE r RECORD; BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='${process.env['PGSCHEMA'] || 'public'}')
      LOOP EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" RESTART IDENTITY CASCADE'; END LOOP;
    END $$;
  `);
}
