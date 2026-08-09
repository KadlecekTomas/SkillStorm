import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrgContextModule } from '@/common/org-context/org-context.module';
import { ClassroomOrchestrationController } from './classroom-orchestration.controller';
import { ClassroomOrchestrationService } from './classroom-orchestration.service';

@Module({
  imports: [OrgContextModule],
  controllers: [ClassroomOrchestrationController],
  providers: [ClassroomOrchestrationService, PrismaService],
  exports: [ClassroomOrchestrationService],
})
export class ClassroomOrchestrationModule {}
