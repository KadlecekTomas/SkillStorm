import { Module } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { RbacModule } from '@/modules/rbac/rbac.module';
import { SubmissionsModule } from '@/submissions/submissions.module';

@Module({
  imports: [AcademicYearsModule, RbacModule, SubmissionsModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService, PrismaService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
