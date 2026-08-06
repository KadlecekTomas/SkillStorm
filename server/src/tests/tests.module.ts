import { Module } from '@nestjs/common';
import { TestsService } from './tests.service';
import { TestsController } from './tests.controller';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { TeacherAssignmentClassAccessGuard } from './guards/teacher-assignment-class-access.guard';

@Module({
  imports: [AcademicYearsModule],
  controllers: [TestsController],
  providers: [TestsService, PrismaService, TeacherAssignmentClassAccessGuard],
})
export class TestsModule {}
