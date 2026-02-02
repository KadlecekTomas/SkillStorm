import { Module } from '@nestjs/common';
import { TestsService } from './tests.service';
import { TestsController } from './tests.controller';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';

@Module({
  imports: [AcademicYearsModule],
  controllers: [TestsController],
  providers: [TestsService, PrismaService],
})
export class TestsModule {}
