const { spawnSync } = require('node:child_process');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for Prisma drift verification.');
  process.exit(1);
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  [
    'prisma',
    'migrate',
    'diff',
    '--from-url',
    process.env.DATABASE_URL,
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
    '--exit-code',
  ],
  { encoding: 'utf8' },
);

if (result.status === 0) {
  console.log('Prisma-representable drift verified: 0 unexpected changes.');
  process.exit(0);
}

if (result.status === 2) {
  console.error('Unexpected Prisma-representable database drift detected:');
  process.stderr.write(result.stderr || '');
  process.stderr.write(result.stdout || '');
  process.exit(1);
}

console.error(`Prisma drift verification could not run (exit ${result.status ?? 'unknown'}).`);
process.stderr.write(result.stderr || '');
process.exit(1);
