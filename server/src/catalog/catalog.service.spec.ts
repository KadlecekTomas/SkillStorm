import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConflictException } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { AuditService } from '@/audit/audit.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService platform management', () => {
  let service: CatalogService;
  const actor = {
    userId: 'user-1',
    organizationId: null,
    organizationRole: null,
    systemRole: SystemRole.SUPERADMIN,
  } as any;

  let prisma: {
    catalogSubject: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    catalogTopic: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let auditService: { log: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    prisma = {
      catalogSubject: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      catalogTopic: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(async (actions: unknown[]) => Promise.all(actions as Promise<unknown>[])),
    };

    auditService = { log: jest.fn() };
    cache = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
  });

  it('creates a subject with normalized uppercase code', async () => {
    prisma.catalogSubject.findFirst.mockResolvedValue(null);
    prisma.catalogSubject.create.mockResolvedValue({
      id: 'subject-1',
      code: 'MATH',
      name: 'Mathematics',
      isActive: true,
      deletedAt: null,
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
    });

    const result = await service.createPlatformSubject(
      { code: ' math ', name: '  Mathematics  ' },
      actor,
    );

    expect(prisma.catalogSubject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'MATH',
          name: 'Mathematics',
        }),
      }),
    );
    expect(result.code).toBe('MATH');
    expect(auditService.log).toHaveBeenCalled();
  });

  it('rejects duplicate subject code', async () => {
    prisma.catalogSubject.findFirst.mockResolvedValue({ id: 'subject-1' });

    await expect(
      service.createPlatformSubject({ code: 'math', name: 'Mathematics' }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a topic under an existing subject', async () => {
    prisma.catalogSubject.findFirst.mockResolvedValue({
      id: 'subject-1',
      name: 'Mathematics',
      code: 'MATH',
    });
    prisma.catalogTopic.findMany.mockResolvedValue([]);
    prisma.catalogTopic.create.mockResolvedValue({
      id: 'topic-1',
      subjectId: 'subject-1',
      name: 'Fractions',
      order: 2,
      isActive: true,
      deletedAt: null,
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
    });

    const result = await service.createPlatformTopic(
      { subjectId: 'subject-1', name: ' Fractions ', order: 2 },
      actor,
    );

    expect(prisma.catalogTopic.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subjectId: 'subject-1',
          name: 'Fractions',
          order: 2,
        }),
      }),
    );
    expect(result.subjectCode).toBe('MATH');
  });

  it('rejects duplicate topic names per subject ignoring casing and spaces', async () => {
    prisma.catalogSubject.findFirst.mockResolvedValue({
      id: 'subject-1',
      name: 'Mathematics',
      code: 'MATH',
    });
    prisma.catalogTopic.findMany.mockResolvedValue([
      { id: 'topic-1', name: 'Fractions' },
    ]);

    await expect(
      service.createPlatformTopic(
        { subjectId: 'subject-1', name: '  fractions  ' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('soft deletes a topic when it is referenced by topic levels', async () => {
    prisma.catalogTopic.findUnique.mockResolvedValue({
      id: 'topic-1',
      deletedAt: null,
      _count: { topicLevels: 3 },
    });
    prisma.catalogTopic.update.mockResolvedValue({});

    const result = await service.deletePlatformTopic('topic-1', actor);

    expect(prisma.catalogTopic.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'topic-1' },
        data: expect.objectContaining({
          isActive: false,
        }),
      }),
    );
    expect(result.mode).toBe('soft');
  });
});
