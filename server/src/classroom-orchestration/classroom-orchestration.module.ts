import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrgContextModule } from '@/common/org-context/org-context.module';
import { AlgorithmLabAnalyticsService } from './algorithm-lab-analytics.service';
import { AlgorithmLabAutoPairService } from './algorithm-lab-auto-pair.service';
import { AlgorithmLabQuickStartService } from './algorithm-lab-quick-start.service';
import { BuildPcAnalyticsService } from './build-pc-analytics.service';
import { ClassroomOrchestrationController } from './classroom-orchestration.controller';
import { ClassroomOrchestrationService } from './classroom-orchestration.service';
import { NetworkedCoopProgramService } from './networked-coop-program.service';
import { NetworkedCoopService } from './networked-coop.service';

@Module({
  imports: [OrgContextModule],
  controllers: [ClassroomOrchestrationController],
  providers: [
    AlgorithmLabAnalyticsService,
    AlgorithmLabAutoPairService,
    AlgorithmLabQuickStartService,
    BuildPcAnalyticsService,
    ClassroomOrchestrationService,
    NetworkedCoopProgramService,
    NetworkedCoopService,
    PrismaService,
  ],
  exports: [
    AlgorithmLabAnalyticsService,
    AlgorithmLabAutoPairService,
    AlgorithmLabQuickStartService,
    ClassroomOrchestrationService,
    NetworkedCoopProgramService,
    NetworkedCoopService,
  ],
})
export class ClassroomOrchestrationModule {}
