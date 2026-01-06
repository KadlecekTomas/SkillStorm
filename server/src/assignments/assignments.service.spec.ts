import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AssignmentsService } from './assignments.service';

describe('AssignmentsService', () => {
  let service: AssignmentsService;
  const prisma = {
    submission: { count: jest.fn() },
    assignment: { delete: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AssignmentsService>(AssignmentsService);
  });

  it('remove → 409 pokud má assignment submissions', async () => {
    prisma.submission.count.mockResolvedValue(1);
    await expect(service.remove('a1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.assignment.delete).not.toHaveBeenCalled();
  });

  it('remove → hard delete pokud submissions neexistují', async () => {
    prisma.submission.count.mockResolvedValue(0);
    prisma.assignment.delete.mockResolvedValue({ id: 'a1' });
    await service.remove('a1');
    expect(prisma.assignment.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });
});
