#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'server/prisma/migrations/20260809005500_curriculum_foundation_d1/migration.sql');
const selfPath = path.join(root, 'scripts/internal/repair-curriculum-dollar-quotes.mjs');
const workflowPath = path.join(root, '.github/workflows/curriculum-dollar-quote-repair.yml');

let migration = fs.readFileSync(migrationPath, 'utf8');

const brokenOpen = 'RETURNS TRIGGER AS $\n';
const brokenClose = '\n$ LANGUAGE plpgsql;';
const openCount = migration.split(brokenOpen).length - 1;
const closeCount = migration.split(brokenClose).length - 1;
if (openCount !== 2 || closeCount !== 2) {
  throw new Error(`Expected exactly 2 broken dollar-quote pairs, got open=${openCount}, close=${closeCount}`);
}

migration = migration.split(brokenOpen).join('RETURNS TRIGGER AS $$\n');
migration = migration.split(brokenClose).join('\n$$ LANGUAGE plpgsql;');

if (migration.includes(brokenOpen) || migration.includes(brokenClose)) {
  throw new Error('Broken single-dollar PL/pgSQL delimiter remains after repair.');
}

fs.writeFileSync(migrationPath, migration);
if (fs.existsSync(selfPath)) fs.rmSync(selfPath);
if (fs.existsSync(workflowPath)) fs.rmSync(workflowPath);
console.log('Repaired exactly two PL/pgSQL dollar-quote pairs.');
