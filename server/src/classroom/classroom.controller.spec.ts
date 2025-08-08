import { Test } from '@nestjs/testing';
import { SchoolGrade } from '@prisma/client';
import { ClassSectionController } from 'src/class-section/class-section.controller';
import { ClassSectionService } from 'src/class-section/class-section.service';

describe('ClassSectionController', () => {
  let controller: ClassSectionController;
  let service: ClassSectionService;

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
      controllers: [ClassSectionController],
      providers: [{ provide: ClassSectionService, useValue: mockService }],
    }).compile();

    controller = module.get(ClassSectionController);
    service = module.get(ClassSectionService);
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
