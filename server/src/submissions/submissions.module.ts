import { Module } from '@nestjs/common';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { PrismaService } from '@/prisma/prisma.service';
import { GamificationModule } from '@/gamification/gamification.module';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { AuditModule } from '@/audit/audit.module';
import { AnalyticsModule } from '@/analytics/analytics.module';

@Module({
  imports: [
    GamificationModule,
    AcademicYearsModule,
    AuditModule,
    AnalyticsModule,
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, PrismaService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
