import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuditModule } from '@/audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformAdminGuard],
})
export class PlatformModule {}
