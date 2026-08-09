import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrgContextModule } from '@/common/org-context/org-context.module';
import { BuildPcAnalyticsService } from './build-pc-analytics.service';
import { ClassroomOrchestrationController } from './classroom-orchestration.controller';
import { ClassroomOrchestrationService } from './classroom-orchestration.service';
import { NetworkedCoopService } from './networked-coop.service';

@Module({
  imports: [OrgContextModule],
  controllers: [ClassroomOrchestrationController],
  providers: [
    BuildPcAnalyticsService,
    ClassroomOrchestrationService,
    NetworkedCoopService,
    PrismaService,
  ],
  exports: [ClassroomOrchestrationService, NetworkedCoopService],
})
export class ClassroomOrchestrationModule {}
