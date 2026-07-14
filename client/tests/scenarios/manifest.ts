import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ScenarioManifest {
  password: string;
  accounts: {
    director: string;
    teacher: string;
    student2a: string;
    student8a: string;
    studentHs: string;
    otherOrgDirector: string;
    otherOrgStudent: string;
  };
  students8A: string[];
  students2A: string[];
  orgId: string;
  class8AId: string;
  class2AId: string;
  assignment8AId: string;
  assignment2AId: string;
  assignmentHSId: string;
  assignmentFast8AId: string;
  foreignOrgId: string;
  foreignTestId: string;
  foreignAssignmentId: string;
}

let cached: ScenarioManifest | null = null;

/** Loads the seed manifest written by global-setup. */
export function loadManifest(): ScenarioManifest {
  if (cached) return cached;
  const raw = readFileSync(join(__dirname, '.manifest.json'), 'utf8');
  cached = JSON.parse(raw) as ScenarioManifest;
  return cached;
}

export const STORAGE_DIR = join(__dirname, '.auth');
export const storageStateFor = (role: string) =>
  join(STORAGE_DIR, `${role}.json`);
