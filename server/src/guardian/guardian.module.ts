import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuditModule } from '@/audit/audit.module';
import { InvitesModule } from '@/invites/invites.module';
import { OrgContextModule } from '@/common/org-context/org-context.module';
import { GuardianService } from './guardian.service';
import { GuardianController } from './guardian.controller';
import { GuardianAdminController } from './guardian-admin.controller';

/**
 * Guardian Etapa B — vztahy rodič↔žák a školou řízené párování.
 * Návrh: docs/guardian/etapa-b-stop2-navrh.md (schválený STOP #2).
 */
@Module({
  imports: [PrismaModule, AuditModule, InvitesModule, OrgContextModule],
  controllers: [GuardianController, GuardianAdminController],
  providers: [GuardianService],
  exports: [GuardianService],
})
export class GuardianModule {}
