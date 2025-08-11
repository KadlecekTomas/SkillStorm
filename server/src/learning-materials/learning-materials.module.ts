import { Module } from '@nestjs/common';
import { LearningMaterialsService } from './learning-materials.service';
import { LearningMaterialsController } from './learning-materials.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [LearningMaterialsController],
  providers: [LearningMaterialsService, PrismaService],
})
export class LearningMaterialsModule {}
