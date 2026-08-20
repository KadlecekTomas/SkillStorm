import { PrismaClient } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertTestDatabaseUrl } = require('../../scripts/db-safety');

const DATABASE_URL = assertTestDatabaseUrl(
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
  'scenarios-zs-product-extension',
);

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const STUDENT_NAMES_8A = [
  'Adam Beneš',
  'Eliška Černá',
  'Matěj Dvořák',
  'Tereza Fialová',
  'Jakub Horák',
  'Natálie Jelínková',
  'Filip Král',
  'Anna Krejčová',
  'David Kučera',
  'Karolína Malá',
  'Vojtěch Marek',
  'Sofie Musilová',
  'Tomáš Němec',
  'Amálie Nováková',
  'Jan Pokorný',
  'Viktorie Procházková',
  'Šimon Růžička',
  'Nela Sedláčková',
  'Martin Svoboda',
  'Laura Šimková',
  'Ondřej Urban',
  'Barbora Veselá',
  'Daniel Vlk',
  'Kristýna Zemanová',
  'Petr Blažek',
  'Adéla Konečná',
  'Michal Soukup',
  'Veronika Tichá',
  'Lukáš Valenta',
  'Ema Žáková',
] as const;

const STUDENT_NAMES_2A = [
  'Matyáš Bartoš',
  'Anežka Hájková',
  'Oliver Kříž',
  'Julie Novotná',
  'Samuel Šťastný',
] as const;

async function getScenarioOrgId(): Promise<string> {
  const org = await prisma.organization.findFirst({
    where: { name: 'ZŠ Scénář' },
    select: { id: true },
  });
  if (!org) throw new Error('Scenario organization ZŠ Scénář not found.');
  return org.id;
}

async function renameScenarioPeople(): Promise<void> {
  await prisma.user.updateMany({
    where: { email: 'director@scenar.test' },
    data: { name: 'Jana Novotná' },
  });
  await prisma.user.updateMany({
    where: { email: 'teacher@scenar.test' },
    data: { name: 'Petr Dvořák' },
  });
  await prisma.user.updateMany({
    where: { email: 'student-hs-01@scenar.test' },
    data: { name: 'Ondřej Marek' },
  });

  for (let index = 0; index < STUDENT_NAMES_8A.length; index += 1) {
    const email = `student-8a-${String(index + 1).padStart(2, '0')}@scenar.test`;
    await prisma.user.updateMany({
      where: { email },
      data: { name: STUDENT_NAMES_8A[index]! },
    });
  }

  for (let index = 0; index < STUDENT_NAMES_2A.length; index += 1) {
    const email = `student-2a-${String(index + 1).padStart(2, '0')}@scenar.test`;
    await prisma.user.updateMany({
      where: { email },
      data: { name: STUDENT_NAMES_2A[index]! },
    });
  }
}

async function modernizeSchoolYear(organizationId: string): Promise<void> {
  // Presentation can show the upcoming 2026/2027 label, but the deterministic
  // scenario seed owns the deliberately broad executable date window. CI may
  // run before 1 September, and product guards must keep rejecting genuinely
  // out-of-year submissions rather than being weakened for screenshots.
  await prisma.academicYear.updateMany({
    where: { orgId: organizationId, isCurrent: true },
    data: { label: '2026/2027' },
  });
}

async function normalizeVisualClassLabels(organizationId: string): Promise<void> {
  // The base scenario intentionally keeps one HIGH_SCHOOL_YEAR_1 enrollment to
  // prove the safe age-mode fallback. That technical enum must stay intact,
  // but the ZŠ visual matrix should not look like a mixed-school fixture.
  // Only presentation fields change; ids, enrollment and grade semantics stay
  // untouched for the scenario contract.
  await prisma.classSection.updateMany({
    where: { orgId: organizationId, label: '1.SŠ' },
    data: { label: '9.B', section: 'B' },
  });
}

async function improveLearningCopy(organizationId: string): Promise<void> {
  await prisma.test.updateMany({
    where: { organizationId, title: 'Matematika 8.A' },
    data: { title: 'Zlomky a poměry — 8.A' },
  });
  await prisma.test.updateMany({
    where: { organizationId, title: 'Poznávání 2.A' },
    data: { title: 'Sčítání do 100 — 2.A' },
  });
  await prisma.test.updateMany({
    where: { organizationId, title: 'Test 1.SŠ' },
    data: { title: 'Algoritmické myšlení — 9.B' },
  });
}

async function main(): Promise<void> {
  const organizationId = await getScenarioOrgId();
  await renameScenarioPeople();
  await modernizeSchoolYear(organizationId);
  await normalizeVisualClassLabels(organizationId);
  await improveLearningCopy(organizationId);

  // eslint-disable-next-line no-console
  console.log(
    `SCENARIO_ZS_PRODUCT_EXTENSION=${JSON.stringify({
      schoolYear: '2026/2027',
      director: 'Jana Novotná',
      teacher: 'Petr Dvořák',
      students8A: STUDENT_NAMES_8A.length,
      students2A: STUDENT_NAMES_2A.length,
    })}`,
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
