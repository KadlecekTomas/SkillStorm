import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LiveSessionMode,
  LiveSessionSourceKind,
  LiveSessionStatus,
} from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { PrismaService } from '@/prisma/prisma.service';

const ACTIVE_STATUSES = [
  LiveSessionStatus.DRAFT,
  LiveSessionStatus.RUNNING,
  LiveSessionStatus.PAUSED,
];

export function classroomCodeForSession(sessionId: string): string {
  const compact = sessionId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${compact.slice(0, 4)}-${compact.slice(4, 8)}`;
}

function normalizeCode(code: string): string {
  return code.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
}

@Injectable()
export class AlgorithmLabJoinCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(code: string, ctx: OrgContext): Promise<{ sessionId: string }> {
    const normalized = normalizeCode(code);
    if (normalized.length !== 8) {
      throw new NotFoundException({
        code: 'CLASSROOM_CODE_NOT_FOUND',
        message: 'Kód hodiny nebyl nalezen.',
      });
    }

    const sessions = await this.prisma.liveSession.findMany({
      where: {
        organizationId: ctx.organizationId,
        sourceKind: LiveSessionSourceKind.LESSON_EXPERIENCE,
        mode: LiveSessionMode.HYBRID,
        status: { in: ACTIVE_STATUSES },
        lessonExperienceVersion: {
          is: {
            stages: { some: { stageKey: 'ALGORITHM_LAB' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true },
    });

    const matches = sessions.filter(
      (session) => normalizeCode(classroomCodeForSession(session.id)) === normalized,
    );

    if (matches.length === 0) {
      throw new NotFoundException({
        code: 'CLASSROOM_CODE_NOT_FOUND',
        message: 'Kód hodiny nebyl nalezen nebo už hodina skončila.',
      });
    }
    if (matches.length > 1) {
      throw new ConflictException({
        code: 'CLASSROOM_CODE_AMBIGUOUS',
        message: 'Kód odpovídá více aktivním hodinám. Použij QR kód nebo odkaz od učitele.',
      });
    }

    return { sessionId: matches[0]!.id };
  }
}
