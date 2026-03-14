import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsController } from './academic-years.controller';
import { AcademicYearsService } from './academic-years.service';
import { PromotionService } from './promotion.service';
import { RequireCurrentAcademicYearGuard } from './require-current-academic-year.guard';
import { AcademicYearExpiredGuard } from './academic-year-expired.guard';
import { AcademicYearRolloverService } from './academic-year-rollover.service';
import { AcademicYearCacheModule } from '@/common/year-cache/academic-year-cache.module';

@Module({
  imports: [AcademicYearCacheModule],
  controllers: [AcademicYearsController],
  providers: [
    AcademicYearsService,
    PromotionService,
    PrismaService,
    RequireCurrentAcademicYearGuard,
    AcademicYearExpiredGuard,
    AcademicYearRolloverService,
  ],
  exports: [
    AcademicYearsService,
    PromotionService,
    RequireCurrentAcademicYearGuard,
    AcademicYearExpiredGuard,
    AcademicYearRolloverService,
  ],
})
export class AcademicYearsModule {}
