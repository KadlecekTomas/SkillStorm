import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { AchievementsService } from './achievements.service';

@Module({
  imports: [PrismaModule],
  controllers: [GamificationController],
  providers: [GamificationService, AchievementsService],
  exports: [GamificationService],
})
export class GamificationModule {}
