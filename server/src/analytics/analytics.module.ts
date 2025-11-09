import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { XpAnalyticsListener } from './listeners/xp-analytics.listener';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, XpAnalyticsListener],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
