/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

module.exports = async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL není nastavená');

  const url = new URL(dbUrl);
  const schema = url.searchParams.get('schema');
  if (!schema) throw new Error('DATABASE_URL nemá ?schema=');

  const base = dbUrl.replace(/(\?|&)schema=[^&]+/, '').replace(/[?&]$/, '');
  const prisma = new PrismaClient({ datasources: { db: { url: base } } });
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await prisma.$disconnect();

  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
};
