import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsController } from './academic-years.controller';
import { AcademicYearsService } from './academic-years.service';
import { PromotionService } from './promotion.service';
import { RequireCurrentAcademicYearGuard } from './require-current-academic-year.guard';

@Module({
  controllers: [AcademicYearsController],
  providers: [
    AcademicYearsService,
    PromotionService,
    PrismaService,
    RequireCurrentAcademicYearGuard,
  ],
  exports: [AcademicYearsService, PromotionService, RequireCurrentAcademicYearGuard],
})
export class AcademicYearsModule {}
