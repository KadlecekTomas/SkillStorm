import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { AuditModule } from '@/audit/audit.module';
import { RiskModule } from '@/risk/risk.module';
import { TeacherAccessModule } from '@/teacher-access/teacher-access.module';
import { ClassSectionsController } from './class-sections.controller';
import { ClassroomsController } from './classrooms.controller';
import { ClassSectionsService } from './class-sections.service';

@Module({
  imports: [AcademicYearsModule, AuditModule, RiskModule, TeacherAccessModule],
  controllers: [ClassSectionsController, ClassroomsController],
  providers: [ClassSectionsService, PrismaService],
})
export class ClassroomModule {}
