import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';

describe('DB invariants for Sprint 1 (raw SQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId: string;
  let otherOrgId: string;
  let yearId: string;
  let classSectionId: string;

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
        endsAt: new Date('2027-06-30'),
        isCurrent: true,
      },
      select: { id: true },
    });
    yearId = year.id;

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
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({ where: { classSectionId } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { id: classSectionId } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { id: yearId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('rejects raw INSERT of class_section with mismatched organization_id vs academic_year.organization_id', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `
        INSERT INTO public.class_sections (class_section_id, organization_id, academic_year_id, grade, section)
        VALUES ($1, $2, $3, 'GRADE_2', 'C')
        `,
        `db-inv-class-${Date.now()}`,
        otherOrgId,
        yearId,
      ),
    ).rejects.toThrow();
  });

  it('rejects raw INSERT of enrollment with academic_year_id differing from class_section.academic_year_id', async () => {
    const wrongYear = await prisma.academicYear.create({
      data: {
        orgId,
        label: `DB Inv Wrong Year ${Date.now()}`,
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-06-30'),
        isCurrent: false,
      },
      select: { id: true },
    });

    const student = await prisma.student.create({
      data: {
        orgId,
        membership: {
          create: {
            user: {
              create: {
                email: `db_inv_student_${Date.now()}@example.com`,
                name: 'DB Inv Student',
                passwordHash: 'x',
              },
            },
            organizationId: orgId,
            role: 'STUDENT',
          },
        },
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
        student.id,
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
        endsAt: new Date('2028-06-30'),
        isCurrent: false,
      },
      select: { id: true },
    });

    await expect(
      prisma.$executeRawUnsafe(
        `
        UPDATE public.academic_years
        SET "isCurrent" = true
        WHERE academic_year_id = $1
        `,
        anotherYear.id,
      ),
    ).rejects.toThrow();
  });
});

