import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { AuditModule } from '@/audit/audit.module';
import { AnalyticsModule } from '@/analytics/analytics.module';
import { StudentsController } from './student.controller';
import { StudentAdminController } from './student-admin.controller';
import { StudentsService } from './student.service';
import { StudentAdminService } from './student-admin.service';
import { StudentAccessGuard } from './guards/student-access.guard';

@Module({
  imports: [AcademicYearsModule, AuditModule, AnalyticsModule],
  controllers: [StudentsController, StudentAdminController],
  providers: [StudentsService, StudentAdminService, StudentAccessGuard, PrismaService],
})
export class StudentsModule {}
