import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ClassSectionsService } from './class-sections.service';
import { OrganizationRole, SystemRole } from '@prisma/client';

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

  it('rejects creating class without academic year', async () => {
    await expect(
      service.create(
        {
          grade: 'GRADE_5' as any,
          section: 'A',
          label: '5.A',
        },
        {
          userId: 'user-1',
          organizationId: 'org-1',
          organizationRole: OrganizationRole.DIRECTOR,
          systemRole: SystemRole.SUPERADMIN,
        } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
