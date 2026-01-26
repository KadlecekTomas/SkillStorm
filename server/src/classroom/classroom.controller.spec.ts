import { Test } from '@nestjs/testing';
import { SchoolGrade, SystemRole } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import type { RequestWithUser } from '@/types/request-with-user';
import { ClassSectionsController } from './class-sections.controller';
import { ClassSectionsService } from './class-sections.service';
import type { CreateClassSectionDto } from './dto/create-classroom.dto';
import type { QueryClassSectionsDto } from './dto/query-class-sections.dto';

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
    const dto: CreateClassSectionDto = {
      yearId: 'year-1',
      grade: SchoolGrade.GRADE_9,
      section: 'A',
      label: '9.A',
    };
    const created = { id: 'cls-1', ...dto };
    mockService.create.mockResolvedValue(created);

    const req = {
      user: {
        userId: 'user-1',
        email: 'user@example.com',
        systemRole: SystemRole.SUPERADMIN,
        organizationId: 'org-1',
      },
    } as RequestWithUser;

    const res = await controller.create(dto, req);
    expect(service.create).toHaveBeenCalledWith(dto, req.user);
    expect(res).toEqual({ success: true, data: created });
  });

  it('findAll() vrací list', async () => {
    const req = {
      user: {
        userId: 'user-1',
        email: 'user@example.com',
        systemRole: SystemRole.SUPERADMIN,
        organizationId: 'org-1',
      },
    } as RequestWithUser;
    const query: QueryClassSectionsDto = {};

    mockService.findAll.mockResolvedValue([{ id: 'cls-1' }]);
    const res = await controller.findAll(req, query);
    expect(service.findAll).toHaveBeenCalledWith(query, req.user);
    expect(res).toEqual({ success: true, data: [{ id: 'cls-1' }] });
  });
});
