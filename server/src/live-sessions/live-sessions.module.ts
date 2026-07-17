import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { CampaignsModule } from '@/campaigns/campaigns.module';
import { LiveSessionsService } from './live-sessions.service';
import { LiveSessionsController } from './live-sessions.controller';

@Module({
  imports: [AcademicYearsModule, CampaignsModule],
  controllers: [LiveSessionsController],
  providers: [LiveSessionsService, PrismaService],
})
export class LiveSessionsModule {}
