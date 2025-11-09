import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { ClassSectionsService } from './class-sections.service';

describe('ClassSectionsService', () => {
  let service: ClassSectionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassSectionsService,
        { provide: PrismaService, useValue: {} },
        { provide: CACHE_MANAGER, useValue: {} },
      ],
    }).compile();

    service = module.get<ClassSectionsService>(ClassSectionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
