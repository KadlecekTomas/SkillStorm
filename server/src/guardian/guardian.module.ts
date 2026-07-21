import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuditModule } from '@/audit/audit.module';
import { InvitesModule } from '@/invites/invites.module';
import { OrgContextModule } from '@/common/org-context/org-context.module';
import { AuthModule } from '@/auth/auth.module';
import { GuardianService } from './guardian.service';
import { GuardianAccessGuard } from './guardian-access.guard';
import { GuardianController } from './guardian.controller';
import { GuardianAdminController } from './guardian-admin.controller';
import { GuardianSessionsService } from './guardian-sessions.service';
import { GuardianSessionsController } from './guardian-sessions.controller';

/**
 * Guardian Etapa B — vztahy rodič↔žák a školou řízené párování.
 * Návrh: docs/guardian/etapa-b-stop2-navrh.md (schválený STOP #2).
 */
@Module({
  imports: [PrismaModule, AuditModule, InvitesModule, OrgContextModule, AuthModule],
  controllers: [
    GuardianController,
    GuardianAdminController,
    GuardianSessionsController,
  ],
  providers: [GuardianService, GuardianAccessGuard, GuardianSessionsService],
  exports: [GuardianService, GuardianSessionsService],
})
export class GuardianModule {}
