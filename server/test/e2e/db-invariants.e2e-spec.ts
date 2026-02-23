import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole } from '@prisma/client';

describe('DB invariants for Sprint 1 (raw SQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId: string;
  let otherOrgId: string;
  let yearId: string;
  let otherYearId: string;
  let classSectionId: string;
  let otherClassSectionId: string;
  let studentId: string;
  let membershipId: string;
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();

    const fk = await prisma.$queryRawUnsafe(
      "SELECT n.nspname AS schema_name, c.relname AS table_name FROM pg_constraint pc JOIN pg_class c ON c.oid = pc.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE pc.conname = 'enrollments_student_id_organization_id_fkey' AND c.relname = 'enrollments'",
    );
    const fkRows = fk as Array<{ schema_name?: string; table_name?: string }>;
    if (!Array.isArray(fkRows) || fkRows.length === 0) {
      throw new Error('Missing FK: enrollments_student_id_organization_id_fkey');
    }
    if (fkRows[0]?.schema_name !== 'public') {
      throw new Error(
        `FK enrollments_student_id_organization_id_fkey attached to ${fkRows[0]?.schema_name}.${fkRows[0]?.table_name}`,
      );
    }

    const orgA = await prisma.organization.create({
      data: { name: `DB Inv Org A ${Date.now()}` },
      select: { id: true },
    });
    const orgB = await prisma.organization.create({
      data: { name: `DB Inv Org B ${Date.now()}` },
      select: { id: true },
    });
    orgId = orgA.id;
    otherOrgId = orgB.id;

    const year = await prisma.academicYear.create({
      data: {
        orgId,
        label: `DB Inv Year ${Date.now()}`,
        startsAt: new Date('2026-09-01'),
        endsAt: new Date('2027-08-31'),
        isCurrent: true,
      },
      select: { id: true },
    });
    yearId = year.id;
    const otherYear = await prisma.academicYear.create({
      data: {
        orgId: otherOrgId,
        label: `DB Inv Year B ${Date.now()}`,
        startsAt: new Date('2026-09-01'),
        endsAt: new Date('2027-08-31'),
        isCurrent: true,
      },
      select: { id: true },
    });
    otherYearId = otherYear.id;

    const cls = await prisma.classSection.create({
      data: {
        orgId,
        yearId,
        grade: 'GRADE_1',
        section: 'B',
        label: '1.B',
      },
      select: { id: true },
    });
    classSectionId = cls.id;
    const otherCls = await prisma.classSection.create({
      data: {
        orgId: otherOrgId,
        yearId: otherYearId,
        grade: 'GRADE_1',
        section: 'C',
        label: '1.C',
      },
      select: { id: true },
    });
    otherClassSectionId = otherCls.id;

    const membership = await prisma.membership.create({
      data: {
        user: {
          create: {
            email: `db_inv_student_${Date.now()}@example.com`,
            name: 'DB Inv Student',
            passwordHash: 'x',
          },
        },
        organization: { connect: { id: orgId } },
        role: OrganizationRole.STUDENT,
      },
      select: { id: true, userId: true },
    });
    membershipId = membership.id;
    userId = membership.userId;
    const student = await prisma.student.create({
      data: {
        orgId,
        membershipId: membership.id,
      },
      select: { id: true },
    });
    studentId = student.id;
    if (!studentId) {
      throw new Error('studentId not set');
    }
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({ where: { classSectionId } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { id: classSectionId } }).catch(() => {});
    await prisma.classSection
      .deleteMany({ where: { id: otherClassSectionId } })
      .catch(() => {});
    await prisma.student.deleteMany({ where: { id: studentId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { id: membershipId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    await prisma.academicYear
      .deleteMany({ where: { id: { in: [yearId, otherYearId] } } })
      .catch(() => {});
    await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('rejects raw INSERT of enrollment with student/org mismatch (cross-org)', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `
        INSERT INTO public.enrollments (enrollment_id, student_id, class_section_id, academic_year_id, organization_id)
        VALUES ($1, $2, $3, $4, $5)
        `,
        `db-inv-enr-${Date.now()}`,
        studentId,
        otherClassSectionId,
        otherYearId,
        otherOrgId,
      ),
    ).rejects.toThrow();
  });

  it('rejects raw INSERT of enrollment with academic_year_id differing from class_section.academic_year_id', async () => {
    const wrongYear = await prisma.academicYear.create({
      data: {
        orgId,
        label: `DB Inv Wrong Year ${Date.now()}`,
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-08-31'),
        isCurrent: false,
      },
      select: { id: true },
    });

    await expect(
      prisma.$executeRawUnsafe(
        `
        INSERT INTO public.enrollments (enrollment_id, student_id, class_section_id, academic_year_id, organization_id)
        VALUES ($1, $2, $3, $4, $5)
        `,
        `db-inv-enr-${Date.now()}`,
        studentId,
        classSectionId,
        wrongYear.id,
        orgId,
      ),
    ).rejects.toThrow();
  });

  it('rejects raw UPDATE that would create two isCurrent=true academic years for the same org', async () => {
    const anotherYear = await prisma.academicYear.create({
      data: {
        orgId,
        label: `DB Inv Another Year ${Date.now()}`,
        startsAt: new Date('2027-09-01'),
        endsAt: new Date('2028-08-31'),
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
  });

  it('rejects raw INSERT of second isCurrent=true academic year for the same org (partial unique index)', async () => {
    const duplicateId = `db-inv-dup-year-${Date.now()}`;
    await expect(
      prisma.$executeRawUnsafe(
        `
        INSERT INTO academic_years (academic_year_id, organization_id, label, "startsAt", "endsAt", "isCurrent", created_at)
        VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)
        `,
        duplicateId,
        orgId,
        `DB Inv Duplicate ${Date.now()}`,
        new Date('2028-09-01'),
        new Date('2029-08-31'),
      ),
    ).rejects.toThrow();
  });
});
