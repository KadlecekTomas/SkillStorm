import { Module } from '@nestjs/common';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { PrismaService } from '@/prisma/prisma.service';
import { GamificationModule } from '@/gamification/gamification.module';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';

@Module({
  imports: [GamificationModule, AcademicYearsModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, PrismaService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
