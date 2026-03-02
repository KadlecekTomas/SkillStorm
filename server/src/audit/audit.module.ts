import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuditService } from './audit.service';
import { AuditDataScopeService } from './audit-data-scope.service';
import { AuditRetentionService } from './audit-retention.service';
import { AuditController } from './audit.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [AuditService, AuditDataScopeService, AuditRetentionService],
  exports: [AuditService, AuditDataScopeService],
})
export class AuditModule {}
