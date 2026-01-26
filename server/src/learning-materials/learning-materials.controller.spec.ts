import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { GamificationService } from '@/gamification/gamification.service';
import { LearningMaterialsController } from './learning-materials.controller';
import { LearningMaterialsService } from './learning-materials.service';

describe('LearningMaterialsController', () => {
  let controller: LearningMaterialsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LearningMaterialsController],
      providers: [
        LearningMaterialsService,
        { provide: PrismaService, useValue: {} },
        { provide: CACHE_MANAGER, useValue: {} },
        { provide: GamificationService, useValue: {} },
      ],
    }).compile();

    controller = module.get<LearningMaterialsController>(
      LearningMaterialsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
