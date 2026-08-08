import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuditModule } from '@/audit/audit.module';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { StudentProgressSelfService } from './student-progress-self.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ProgressController],
  providers: [ProgressService, StudentProgressSelfService],
  exports: [ProgressService],
})
export class ProgressModule {}
