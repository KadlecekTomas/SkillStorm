import { Module } from '@nestjs/common';
import { LearningMaterialsService } from './learning-materials.service';
import { LearningMaterialsController } from './learning-materials.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { GamificationModule } from 'src/gamification/gamification.module';

@Module({
  imports: [GamificationModule],
  controllers: [LearningMaterialsController],
  providers: [LearningMaterialsService, PrismaService],
})
export class LearningMaterialsModule {}
