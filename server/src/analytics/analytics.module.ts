import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { XpAnalyticsListener } from './listeners/xp-analytics.listener';

@Module({
  imports: [PrismaModule, AcademicYearsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, XpAnalyticsListener],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
