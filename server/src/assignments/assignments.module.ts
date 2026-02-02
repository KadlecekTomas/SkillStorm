import { Module } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';

@Module({
  imports: [AcademicYearsModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService, PrismaService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
