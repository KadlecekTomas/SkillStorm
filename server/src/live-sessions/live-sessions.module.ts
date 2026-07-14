import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { LiveSessionsService } from './live-sessions.service';
import { LiveSessionsController } from './live-sessions.controller';

@Module({
  imports: [AcademicYearsModule],
  controllers: [LiveSessionsController],
  providers: [LiveSessionsService, PrismaService],
})
export class LiveSessionsModule {}
