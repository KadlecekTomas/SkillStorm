import { Module } from '@nestjs/common';
import { AuditModule } from '@/audit/audit.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { PlatformAccessGuard } from '@/common/guards/platform-access.guard';
import { SystemRoleGuard } from '@/common/guards/system-role.guard';
import { SupportController } from './support.controller';
import { SupportDataScopeService } from './support-data-scope.service';
import { SupportService } from './support.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SupportController],
  providers: [SupportService, SupportDataScopeService, SystemRoleGuard, PlatformAccessGuard],
})
export class SupportModule {}
