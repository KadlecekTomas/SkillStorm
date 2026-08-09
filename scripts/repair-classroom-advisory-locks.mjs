import fs from 'node:fs';

const path = 'server/src/classroom-orchestration/classroom-orchestration.service.ts';
let source = fs.readFileSync(path, 'utf8');
const before = 'tx.$queryRaw`SELECT pg_advisory_xact_lock';
const after = 'tx.$executeRaw`SELECT pg_advisory_xact_lock';
const count = source.split(before).length - 1;
if (count !== 3) throw new Error(`Expected 3 D2-C advisory locks, found ${count}`);
source = source.replaceAll(before, after);
fs.writeFileSync(path, source);
console.log('Repaired 3 D2-C advisory locks to Prisma $executeRaw.');
