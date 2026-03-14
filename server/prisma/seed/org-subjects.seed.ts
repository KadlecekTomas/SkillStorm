import { PrismaClient } from '@prisma/client';
import { logDone, logStep } from './seed-helpers';

export async function seed(prisma: PrismaClient) {
  logStep('OrgSubjects > creating enabled org subject rows');

  const organizations = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });

  for (const organization of organizations) {
    const subjects = await prisma.subject.findMany({
      where: {
        deletedAt: null,
      },
      select: { id: true },
    });

    if (subjects.length === 0) continue;

    await prisma.orgSubject.createMany({
      data: subjects.map((subject) => ({
        organizationId: organization.id,
        subjectId: subject.id,
        isEnabled: true,
        isCustom: false,
      })),
      skipDuplicates: true,
    });
  }

  logDone('OrgSubjects ready');
}
