import { Module } from '@nestjs/common';
import { AuditModule } from '@/audit/audit.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { SystemRoleGuard } from '@/common/guards/system-role.guard';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SupportController],
  providers: [SupportService, SystemRoleGuard],
})
export class SupportModule {}
