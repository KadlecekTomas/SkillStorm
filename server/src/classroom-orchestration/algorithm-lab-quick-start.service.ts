import { ConflictException, Injectable } from '@nestjs/common';
import {
  ActivityDeliveryMode,
  LessonExperienceScope,
  LessonExperienceVersionStatus,
  LiveSessionMode,
} from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { PrismaService } from '@/prisma/prisma.service';
import { ClassroomOrchestrationService } from './classroom-orchestration.service';

@Injectable()
export class AlgorithmLabQuickStartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classroom: ClassroomOrchestrationService,
  ) {}

  async launch(ctx: OrgContext) {
    const version = await this.prisma.lessonExperienceVersion.findFirst({
      where: {
        status: LessonExperienceVersionStatus.PUBLISHED,
        supportedModes: { has: ActivityDeliveryMode.HYBRID },
        lessonExperience: {
          is: {
            deletedAt: null,
            OR: [
              { scope: LessonExperienceScope.GLOBAL },
              {
                scope: LessonExperienceScope.ORGANIZATION,
                organizationId: ctx.organizationId,
              },
            ],
          },
        },
        stages: { some: { stageKey: 'ALGORITHM_LAB' } },
      },
      orderBy: [{ versionNo: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });

    if (!version) {
      throw new ConflictException({
        code: 'ALGORITHM_LAB_NOT_PUBLISHED',
        message:
          'Algorithm Lab zatím nemá publikovanou HYBRID Lesson Experience. Publikuj ji před spuštěním hodiny.',
      });
    }

    return this.classroom.createLessonSession(
      {
        lessonExperienceVersionId: version.id,
        mode: LiveSessionMode.HYBRID,
      },
      ctx,
    );
  }
}
