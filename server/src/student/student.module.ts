import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { StudentsController } from './student.controller';
import { StudentsService } from './student.service';

@Module({
  imports: [AcademicYearsModule],
  controllers: [StudentsController],
  providers: [StudentsService, PrismaService],
})
export class StudentsModule {}
