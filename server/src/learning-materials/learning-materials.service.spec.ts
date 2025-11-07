import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from 'src/prisma/prisma.service';
import { LearningMaterialsService } from './learning-materials.service';

describe('LearningMaterialsService', () => {
  let service: LearningMaterialsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningMaterialsService,
        { provide: PrismaService, useValue: {} },
        { provide: CACHE_MANAGER, useValue: {} },
      ],
    }).compile();

    service = module.get<LearningMaterialsService>(LearningMaterialsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
