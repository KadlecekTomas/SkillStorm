import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CampaignContentService } from './campaign-content.service';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';

@Module({
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignContentService, PrismaService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
