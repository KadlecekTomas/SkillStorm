import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SchoolGrade } from '@prisma/client';

export interface CatalogSyncResult {
  orgsProcessed: number;
  catalogSubjectsFound: number;
  /** Total subject-level upsert operations executed (orgs × subjects × grades). */
  levelUpserts: number;
}

/**
 * Synchronises the current CatalogSubject catalog into every non-deleted organization.
 *
 * For each org:
 *   - upsert global Subject per CatalogSubject
 *   - upsert OrgSubject activation for the org
 *   - upsert SubjectLevel per SchoolGrade
 *
 * All operations are idempotent — safe to re-run without side effects.
 */
@Injectable()
export class CatalogSyncService {
  private readonly grades = Object.values(SchoolGrade);

  constructor(private readonly prisma: PrismaService) {}

  async syncSubjectsToAllOrgs(): Promise<CatalogSyncResult> {
    const [orgs, catalogSubjects] = await Promise.all([
      this.prisma.organization.findMany({
        where: { deletedAt: null },
        select: { id: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.catalogSubject.findMany({ orderBy: { name: 'asc' } }),
    ]);

    if (!catalogSubjects.length || !orgs.length) {
      return { orgsProcessed: 0, catalogSubjectsFound: catalogSubjects.length, levelUpserts: 0 };
    }

    let levelUpserts = 0;

    for (const org of orgs) {
      await this.prisma.$transaction(async (tx) => {
        for (const catalog of catalogSubjects) {
          const subject = await tx.subject.upsert({
            where: { catalogSubjectId: catalog.id },
            update: {},
            create: {
              catalogSubjectId: catalog.id,
              name: catalog.name,
              gradeFrom: 1,
              gradeTo: 9,
            },
          });
          await tx.orgSubject.upsert({
            where: {
              organizationId_subjectId: {
                organizationId: org.id,
                subjectId: subject.id,
              },
            },
            update: { isEnabled: true },
            create: {
              organizationId: org.id,
              subjectId: subject.id,
              isEnabled: true,
              isCustom: false,
            },
          });

          for (const grade of this.grades) {
            await tx.subjectLevel.upsert({
              where: { subjectId_grade: { subjectId: subject.id, grade } },
              update: {},
              create: { subjectId: subject.id, grade, order: null, label: null },
            });
            levelUpserts++;
          }
        }
      });
    }

    return {
      orgsProcessed: orgs.length,
      catalogSubjectsFound: catalogSubjects.length,
      levelUpserts,
    };
  }
}
