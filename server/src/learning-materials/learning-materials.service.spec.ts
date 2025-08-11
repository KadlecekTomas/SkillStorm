import { Test, TestingModule } from '@nestjs/testing';
import { LearningMaterialsService } from './learning-materials.service';

describe('LearningMaterialsService', () => {
  let service: LearningMaterialsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LearningMaterialsService],
    }).compile();

    service = module.get<LearningMaterialsService>(LearningMaterialsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
