import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrgContextModule } from '@/common/org-context/org-context.module';
import { BuildPcAnalyticsService } from './build-pc-analytics.service';
import { ClassroomOrchestrationController } from './classroom-orchestration.controller';
import { ClassroomOrchestrationService } from './classroom-orchestration.service';

@Module({
  imports: [OrgContextModule],
  controllers: [ClassroomOrchestrationController],
  providers: [BuildPcAnalyticsService, ClassroomOrchestrationService, PrismaService],
  exports: [ClassroomOrchestrationService],
})
export class ClassroomOrchestrationModule {}
