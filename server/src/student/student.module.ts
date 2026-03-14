import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { AuditModule } from '@/audit/audit.module';
import { AnalyticsModule } from '@/analytics/analytics.module';
import { StudentsController } from './student.controller';
import { StudentsService } from './student.service';
import { StudentAccessGuard } from './guards/student-access.guard';

@Module({
  imports: [AcademicYearsModule, AuditModule, AnalyticsModule],
  controllers: [StudentsController],
  providers: [StudentsService, StudentAccessGuard, PrismaService],
})
export class StudentsModule {}
