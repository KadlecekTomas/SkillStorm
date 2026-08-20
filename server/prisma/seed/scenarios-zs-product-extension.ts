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
  await prisma.academicYear.updateMany({
    where: { orgId: organizationId, isCurrent: true },
    data: {
      label: '2026/2027',
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
      endsAt: new Date('2027-08-31T23:59:59.999Z'),
    },
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
}

async function main(): Promise<void> {
  const organizationId = await getScenarioOrgId();
  await renameScenarioPeople();
  await modernizeSchoolYear(organizationId);
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
