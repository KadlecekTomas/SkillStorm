import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { XpAnalyticsListener } from './listeners/xp-analytics.listener';
import { StudentDiagnosticService } from './student-diagnostic.service';

@Module({
  imports: [PrismaModule, AcademicYearsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, StudentDiagnosticService, XpAnalyticsListener],
  exports: [AnalyticsService, StudentDiagnosticService],
})
export class AnalyticsModule {}
