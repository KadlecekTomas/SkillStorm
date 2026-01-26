import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsController } from './academic-years.controller';
import { AcademicYearsService } from './academic-years.service';

@Module({
  controllers: [AcademicYearsController],
  providers: [AcademicYearsService, PrismaService],
  exports: [AcademicYearsService],
})
export class AcademicYearsModule {}
