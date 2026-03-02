/**
 * Backfill: provision default Subject + SubjectLevel records for every existing organization.
 *
 * Run once after deploying the auto-provisioning feature to cover orgs created before it.
 * Idempotent: uses upsert; safe to re-run.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-subjects.ts
 */
import { PrismaClient, SchoolGrade } from '@prisma/client';

const prisma = new PrismaClient();
const GRADES = Object.values(SchoolGrade);

async function main() {
  console.log('📚 Backfill: Subject + SubjectLevel records per organization');

  const catalogSubjects = await prisma.catalogSubject.findMany({ orderBy: { name: 'asc' } });
  if (!catalogSubjects.length) {
    console.warn('⚠️  No CatalogSubject records found — nothing to provision.');
    console.warn('    Seed the catalog first: npm run seed:full');
    return;
  }
  console.log(`   CatalogSubjects: ${catalogSubjects.map((c) => c.code).join(', ')}`);
  console.log(`   SchoolGrades: ${GRADES.length} values`);

  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  console.log(`   Organizations to backfill: ${orgs.length}\n`);

  for (const org of orgs) {
    await prisma.$transaction(async (tx) => {
      for (const catalog of catalogSubjects) {
        const subject = await tx.subject.upsert({
          where: {
            organizationId_catalogSubjectId: {
              organizationId: org.id,
              catalogSubjectId: catalog.id,
            },
          },
          update: {},
          create: {
            organizationId: org.id,
            catalogSubjectId: catalog.id,
            name: catalog.name,
          },
        });

        for (const grade of GRADES) {
          await tx.subjectLevel.upsert({
            where: { subjectId_grade: { subjectId: subject.id, grade } },
            update: {},
            create: { subjectId: subject.id, grade, order: null, label: null },
          });
        }
      }
    });

    console.log(
      `   ✅ ${org.name} — ${catalogSubjects.length} subjects × ${GRADES.length} grades = ${catalogSubjects.length * GRADES.length} level slots`,
    );
  }

  console.log(
    `\n✅ Done. ${orgs.length} orgs × ${catalogSubjects.length} subjects × ${GRADES.length} grades = ${orgs.length * catalogSubjects.length * GRADES.length} total level slots.`,
  );
}

main()
  .catch((err) => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
