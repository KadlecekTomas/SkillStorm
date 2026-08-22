const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function fingerprint(definition) {
  return createHash('sha256').update(definition).digest('hex');
}

function loadExpected() {
  const manifestPath = join(__dirname, '..', 'prisma', 'raw-sql-invariants.txt');
  return readFileSync(manifestPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [kind, table, name, definitionSha256, extra] = line.split('|');
      if (extra || !kind || !table || !name || !/^[a-f0-9]{64}$/.test(definitionSha256)) {
        throw new Error(`Invalid raw invariant manifest row: ${line}`);
      }
      return { kind, table, name, definitionSha256 };
    });
}

async function loadActual() {
  const checks = await prisma.$queryRawUnsafe(`
    SELECT c.relname AS table, con.conname AS name,
           pg_get_constraintdef(con.oid, true) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND con.contype = 'c'
    ORDER BY c.relname, con.conname
  `);
  const partialIndexes = await prisma.$queryRawUnsafe(`
    SELECT t.relname AS table, i.relname AS name,
           pg_get_indexdef(ix.indexrelid) AS definition
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND ix.indpred IS NOT NULL
    ORDER BY t.relname, i.relname
  `);
  const triggers = await prisma.$queryRawUnsafe(`
    SELECT c.relname AS table, t.tgname AS name,
           pg_get_triggerdef(t.oid, true) AS definition
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname
  `);

  return [
    ...checks.map((row) => ({ kind: 'check', ...row })),
    ...partialIndexes.map((row) => ({ kind: 'partial_index', ...row })),
    ...triggers.map((row) => ({ kind: 'trigger', ...row })),
  ].map(({ kind, table, name, definition }) => ({
    kind,
    table,
    name,
    definitionSha256: fingerprint(definition),
  }));
}

function key(object) {
  return `${object.kind}|${object.table}|${object.name}`;
}

async function main() {
  const [{ versionNumber }] = await prisma.$queryRawUnsafe(
    `SELECT current_setting('server_version_num')::integer AS "versionNumber"`,
  );
  const postgresMajor = Math.floor(versionNumber / 10000);
  if (postgresMajor !== 15) {
    throw new Error(`Raw invariant fingerprints require PostgreSQL 15; found ${postgresMajor}`);
  }

  const expected = loadExpected();
  const actual = await loadActual();
  const expectedByKey = new Map(expected.map((object) => [key(object), object]));
  const actualByKey = new Map(actual.map((object) => [key(object), object]));
  const failures = [];

  for (const [objectKey, expectedObject] of expectedByKey) {
    const actualObject = actualByKey.get(objectKey);
    if (!actualObject) {
      failures.push(`missing ${objectKey}`);
    } else if (actualObject.definitionSha256 !== expectedObject.definitionSha256) {
      failures.push(
        `changed ${objectKey}: expected ${expectedObject.definitionSha256}, got ${actualObject.definitionSha256}`,
      );
    }
  }
  for (const objectKey of actualByKey.keys()) {
    if (!expectedByKey.has(objectKey)) failures.push(`unexpected ${objectKey}`);
  }

  if (failures.length > 0) {
    console.error('Raw SQL invariant verification FAILED:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  const counts = actual.reduce((result, object) => {
    result[object.kind] = (result[object.kind] || 0) + 1;
    return result;
  }, {});
  console.log(
    `Raw SQL invariants verified: ${actual.length} total ` +
      `(${counts.check} CHECK, ${counts.partial_index} partial index, ${counts.trigger} trigger).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
