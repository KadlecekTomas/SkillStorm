import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';

@Module({
  imports: [AcademicYearsModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, PrismaService],
})
export class EnrollmentsModule {}
