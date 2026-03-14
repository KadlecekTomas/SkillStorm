import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { AuditModule } from '@/audit/audit.module';

@Module({
  imports: [AcademicYearsModule, AuditModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, PrismaService],
})
export class EnrollmentsModule {}
