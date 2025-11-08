import { Test } from '@nestjs/testing';
import { SchoolGrade } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClassSectionsController } from './class-sections.controller';
import { ClassSectionsService } from './class-sections.service';

describe('ClassSectionsController', () => {
  let controller: ClassSectionsController;
  let service: ClassSectionsService;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    setHomeroom: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ClassSectionsController],
      providers: [
        { provide: ClassSectionsService, useValue: mockService },
        { provide: PrismaService, useValue: {} },
        { provide: CACHE_MANAGER, useValue: {} },
      ],
    }).compile();

    controller = module.get(ClassSectionsController);
    service = module.get(ClassSectionsService);
  });

  afterEach(() => jest.resetAllMocks());

  it('create() volej service s DTO', async () => {
    const dto = {
      orgId: 'org-1',
      yearId: 'year-1',
      grade: SchoolGrade.GRADE_9,
      section: 'A',
      label: '9.A',
    };
    const created = { id: 'cls-1', ...dto };
    mockService.create.mockResolvedValue(created);

    const res = await controller.create(dto as any);
    expect(service.create).toHaveBeenCalledWith(dto);
    expect(res).toEqual(created);
  });

  it('findAll() vrací list', async () => {
    mockService.findAll.mockResolvedValue([{ id: 'cls-1' }]);
    expect(await controller.findAll()).toEqual([{ id: 'cls-1' }]);
  });
});
