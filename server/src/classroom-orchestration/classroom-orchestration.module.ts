import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrgContextModule } from '@/common/org-context/org-context.module';
import { AlgorithmLabAnalyticsService } from './algorithm-lab-analytics.service';
import { AlgorithmLabAutoPairService } from './algorithm-lab-auto-pair.service';
import { AlgorithmLabJoinCodeService } from './algorithm-lab-join-code.service';
import { AlgorithmLabQuickStartService } from './algorithm-lab-quick-start.service';
import { BuildPcAnalyticsService } from './build-pc-analytics.service';
import { ClassroomOrchestrationController } from './classroom-orchestration.controller';
import { ClassroomOrchestrationService } from './classroom-orchestration.service';
import { ClassroomStudentAccessService } from './classroom-student-access.service';
import { NetworkedCoopProgramService } from './networked-coop-program.service';
import { NetworkedCoopService } from './networked-coop.service';

@Module({
  imports: [OrgContextModule],
  controllers: [ClassroomOrchestrationController],
  providers: [
    AlgorithmLabAnalyticsService,
    AlgorithmLabAutoPairService,
    AlgorithmLabJoinCodeService,
    AlgorithmLabQuickStartService,
    BuildPcAnalyticsService,
    ClassroomOrchestrationService,
    ClassroomStudentAccessService,
    NetworkedCoopProgramService,
    NetworkedCoopService,
    PrismaService,
  ],
  exports: [
    AlgorithmLabAnalyticsService,
    AlgorithmLabAutoPairService,
    AlgorithmLabJoinCodeService,
    AlgorithmLabQuickStartService,
    ClassroomOrchestrationService,
    ClassroomStudentAccessService,
    NetworkedCoopProgramService,
    NetworkedCoopService,
  ],
})
export class ClassroomOrchestrationModule {}
