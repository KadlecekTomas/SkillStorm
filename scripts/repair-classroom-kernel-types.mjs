import fs from 'node:fs';

const path = 'server/src/classroom-orchestration/classroom-orchestration.service.ts';
let source = fs.readFileSync(path, 'utf8');
const before = 'payload: dto.payload as Prisma.InputJsonValue | undefined,';
const after = `payload:\n            dto.payload === undefined\n              ? Prisma.DbNull\n              : (dto.payload as Prisma.InputJsonValue),`;
const count = source.split(before).length - 1;
if (count !== 2) throw new Error(`Expected 2 payload anchors, found ${count}`);
source = source.replaceAll(before, after);
fs.writeFileSync(path, source);
console.log('D2-C Prisma JSON payload typing repaired.');
