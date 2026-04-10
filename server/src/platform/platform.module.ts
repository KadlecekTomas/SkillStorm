import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformDataScopeService } from './platform-data-scope.service';
import { PlatformMutationAuditInterceptor } from './platform-mutation-audit.interceptor';
import { PlatformHealthService } from './platform-health.service';
import { CatalogSyncService } from './catalog-sync.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuditModule } from '@/audit/audit.module';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { SystemRoleGuard } from '@/common/guards/system-role.guard';
import { PlatformAccessGuard } from '@/common/guards/platform-access.guard';
import { OrgAccessPolicy } from './org-access-policy.service';

@Module({
  imports: [PrismaModule, AuditModule, AcademicYearsModule],
  controllers: [PlatformController],
  providers: [
    PlatformService,
    PlatformDataScopeService,
    PlatformMutationAuditInterceptor,
    PlatformHealthService,
    CatalogSyncService,
    OrgAccessPolicy,
    SystemRoleGuard,
    PlatformAccessGuard,
  ],
  exports: [OrgAccessPolicy],
})
export class PlatformModule {}
