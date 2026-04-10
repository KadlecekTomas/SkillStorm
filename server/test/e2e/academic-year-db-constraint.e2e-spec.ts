import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { AppModule } from '@/app.module';
import { OrganizationStatus } from '@prisma/client';
import { setupOrgContext } from 'test/helpers';

describe('Academic year DB constraint (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId: string;
  let currentYearId: string;
  let userIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();

    const ctx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `ay_db_${Date.now()}`,
    });

    orgId = ctx.organization.id;
    userIds = [ctx.owner.user.id];

    await prisma.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    const current = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true, deletedAt: null },
      select: { id: true },
    });
    if (!current) {
      throw new Error('Expected fixture org to have exactly one current year');
    }
    currentYearId = current.id;
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
      await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
      await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    }
    if (userIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('rejects raw INSERT of second isCurrent=true academic year for the same org', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `
        INSERT INTO academic_years (academic_year_id, organization_id, label, "startsAt", "endsAt", "isCurrent", created_at)
        VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)
        `,
        `ay-dup-${Date.now()}`,
        orgId,
        `AY Duplicate ${Date.now()}`,
        new Date('2030-09-01'),
        new Date('2031-08-31'),
      ),
    ).rejects.toThrow();
  });

  it('rejects raw UPDATE that would create two isCurrent=true academic years for the same org', async () => {
    const anotherYear = await prisma.academicYear.create({
      data: {
        orgId,
        label: `AY Another ${Date.now()}`,
        startsAt: new Date('2031-09-01'),
        endsAt: new Date('2032-08-31'),
        isCurrent: false,
      },
      select: { id: true },
    });

    await expect(
      prisma.$executeRawUnsafe(
        `
        UPDATE academic_years
        SET "isCurrent" = true
        WHERE academic_year_id = $1
        `,
        anotherYear.id,
      ),
    ).rejects.toThrow();

    const currentRows = await prisma.academicYear.findMany({
      where: { orgId, isCurrent: true, deletedAt: null },
      select: { id: true },
      orderBy: { startsAt: 'desc' },
    });
    expect(currentRows).toHaveLength(1);
    expect(currentRows[0]?.id).toBe(currentYearId);
  });
});
