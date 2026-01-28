import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsController } from './academic-years.controller';
import { AcademicYearsService } from './academic-years.service';
import { RequireActiveAcademicYearGuard } from './require-active-academic-year.guard';

@Module({
  controllers: [AcademicYearsController],
  providers: [AcademicYearsService, PrismaService, RequireActiveAcademicYearGuard],
  exports: [AcademicYearsService, RequireActiveAcademicYearGuard],
})
export class AcademicYearsModule {}
