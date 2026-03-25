import { Module } from '@nestjs/common';
import { RiskModule } from '@/risk/risk.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { PrismaService } from '@/prisma/prisma.service';

@Module({
  imports: [RiskModule],
  controllers: [StatsController],
  providers: [StatsService, PrismaService],
})
export class StatsModule {}
