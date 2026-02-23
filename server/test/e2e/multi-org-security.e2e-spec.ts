import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import {
  OrganizationRole,
  OrganizationStatus,
  SchoolGrade,
} from '@prisma/client';
import { authAs, useOrg } from 'test/helpers';

function unwrapBody(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

function uniqueYearLabel(base: string) {
  return `${base}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

describe('Multi-org security hardening (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let actorOrgAToken = '';
  let directorOrgBToken = '';

  let orgAId = '';
  let orgBId = '';
  let yearOrgAId = '';
  let actorMembershipOrgAId = '';

  let classSectionOrgAId = '';
  let classSectionOrgBId = '';
  let classSectionOrgBOtherYearId = '';
  let testOrgAId = '';
  let testOrgBId = '';
  let assignmentOrgBId = '';

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();

    const actor = await authAs(app, OrganizationRole.DIRECTOR, {
      seed: 'multi_org_actor',
      name: 'Multi Org Actor',
    });
    const directorB = await authAs(app, OrganizationRole.DIRECTOR, {
      seed: 'multi_org_director_b',
      name: 'Multi Org Director B',
    });

    orgAId = actor.organization.id;
    orgBId = directorB.organization.id;

    await prisma.organization.updateMany({
      where: { id: { in: [orgAId, orgBId] } },
      data: { status: OrganizationStatus.ACTIVE },
    });

    const currentYearOrgA = await prisma.academicYear.findFirst({
      where: { orgId: orgAId, isCurrent: true },
      select: { id: true },
    });
    yearOrgAId = currentYearOrgA
      ? currentYearOrgA.id
      : (
          await prisma.academicYear.create({
            data: {
              orgId: orgAId,
              label: uniqueYearLabel('orgA_current'),
              startsAt: new Date('2025-09-01T00:00:00.000Z'),
              endsAt: new Date('2026-06-30T23:59:59.000Z'),
              isCurrent: true,
            },
            select: { id: true },
          })
        ).id;
    await prisma.academicYear.updateMany({
      where: { orgId: orgAId, id: { not: yearOrgAId } },
      data: { isCurrent: false },
    });
    await prisma.academicYear.update({
      where: { id: yearOrgAId },
      data: { isCurrent: true },
    });
    const orgASuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    classSectionOrgAId = (
      await prisma.classSection.create({
        data: {
          orgId: orgAId,
          yearId: yearOrgAId,
          grade: SchoolGrade.GRADE_5,
          section: `A${orgASuffix}`,
          label: `5.A${orgASuffix}`,
        },
        select: { id: true },
      })
    ).id;

    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: actor.user.id,
          organizationId: orgBId,
        },
      },
      update: {
        role: OrganizationRole.TEACHER,
        deletedAt: null,
      },
      create: {
        userId: actor.user.id,
        organizationId: orgBId,
        role: OrganizationRole.TEACHER,
      },
    });
    const actorMembershipOrgA = await prisma.membership.findFirst({
      where: {
        userId: actor.user.id,
        organizationId: orgAId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!actorMembershipOrgA) {
      throw new Error('Actor membership in org A missing');
    }
    actorMembershipOrgAId = actorMembershipOrgA.id;

    actorOrgAToken = await useOrg(app, actor.accessToken, orgAId);
    directorOrgBToken = await useOrg(app, directorB.accessToken, orgBId);

    const currentYearOrgB = await prisma.academicYear.findFirst({
      where: { orgId: orgBId, isCurrent: true },
      select: { id: true },
    });

    const yearOrgBId = currentYearOrgB
      ? currentYearOrgB.id
      : (
          await prisma.academicYear.create({
            data: {
              orgId: orgBId,
              label: uniqueYearLabel('orgB_current'),
              startsAt: new Date('2025-09-01T00:00:00.000Z'),
              endsAt: new Date('2026-06-30T23:59:59.000Z'),
              isCurrent: true,
            },
            select: { id: true },
          })
        ).id;
    await prisma.academicYear.updateMany({
      where: { orgId: orgBId, id: { not: yearOrgBId } },
      data: { isCurrent: false },
    });
    await prisma.academicYear.update({
      where: { id: yearOrgBId },
      data: { isCurrent: true },
    });

    const yearOrgBOtherId = (
      await prisma.academicYear.create({
        data: {
          orgId: orgBId,
          label: uniqueYearLabel('orgB_other'),
          startsAt: new Date('2024-09-01T00:00:00.000Z'),
          endsAt: new Date('2025-06-30T23:59:59.000Z'),
          isCurrent: false,
        },
        select: { id: true },
      })
    ).id;

    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    classSectionOrgBId = (
      await prisma.classSection.create({
        data: {
          orgId: orgBId,
          yearId: yearOrgBId,
          grade: SchoolGrade.GRADE_5,
          section: `M${suffix}`,
          label: `5.M${suffix}`,
        },
        select: { id: true },
      })
    ).id;

    classSectionOrgBOtherYearId = (
      await prisma.classSection.create({
        data: {
          orgId: orgBId,
          yearId: yearOrgBOtherId,
          grade: SchoolGrade.GRADE_5,
          section: `N${suffix}`,
          label: `5.N${suffix}`,
        },
        select: { id: true },
      })
    ).id;

    const directorBMembership = await prisma.membership.findFirst({
      where: {
        userId: directorB.user.id,
        organizationId: orgBId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!directorBMembership) {
      throw new Error('Director B membership missing');
    }

    testOrgAId = (
      await prisma.test.create({
        data: {
          title: `MultiOrg test A ${suffix}`,
          organizationId: orgAId,
          creatorId: actorMembershipOrgAId,
          status: 'PUBLISHED',
        },
        select: { id: true },
      })
    ).id;

    await prisma.question.create({
      data: {
        testId: testOrgAId,
        text: 'Org A valid assignability question',
        type: 'TRUE_FALSE',
        score: 1,
        correctAnswer: 'true',
        order: 1,
      },
    });

    testOrgBId = (
      await prisma.test.create({
        data: {
          title: `MultiOrg test ${suffix}`,
          organizationId: orgBId,
          creatorId: directorBMembership.id,
          status: 'PUBLISHED',
        },
        select: { id: true },
      })
    ).id;

    await prisma.question.create({
      data: {
        testId: testOrgBId,
        text: 'Org B valid assignability question',
        type: 'TRUE_FALSE',
        score: 1,
        correctAnswer: 'true',
        order: 1,
      },
    });

    assignmentOrgBId = (
      await prisma.assignment.create({
        data: {
          organizationId: orgBId,
          yearId: yearOrgBId,
          testId: testOrgBId,
          targetType: 'CLASS',
          classSectionId: classSectionOrgBId,
          topicLevelId: null,
          openAt: new Date(Date.now() - 60_000),
          closeAt: new Date(Date.now() + 60 * 60 * 1000),
          maxAttempts: 1,
          shuffle: true,
          showExplain: 'after_close',
          createdById: directorBMembership.id,
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.assignment.deleteMany({ where: { id: assignmentOrgBId } }).catch(() => {});
    await prisma.question.deleteMany({ where: { testId: { in: [testOrgAId, testOrgBId] } } }).catch(() => {});
    await prisma.test.deleteMany({ where: { id: { in: [testOrgAId, testOrgBId] } } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { id: { in: [classSectionOrgAId, classSectionOrgBId, classSectionOrgBOtherYearId] } } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('active org A user cannot read class section from org B', async () => {
    const res = await request(app.getHttpServer())
      .get(`/class-sections/${classSectionOrgBId}`)
      .set('Authorization', `Bearer ${actorOrgAToken}`);

    expect(res.status).toBe(404);
  });

  it('active org A user cannot read test from org B', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tests/${testOrgBId}`)
      .set('Authorization', `Bearer ${actorOrgAToken}`);

    expect(res.status).toBe(404);
  });

  it('query organizationId cannot override active org context on test detail', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tests/${testOrgBId}`)
      .query({ organizationId: orgBId })
      .set('Authorization', `Bearer ${actorOrgAToken}`);

    expect(res.status).toBe(404);
  });

  it('active org A user cannot read assignment from org B', async () => {
    const res = await request(app.getHttpServer())
      .get(`/assignments/${assignmentOrgBId}`)
      .set('Authorization', `Bearer ${actorOrgAToken}`);

    expect(res.status).toBe(404);
  });

  it('active org A user cannot PATCH test from org B', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tests/${testOrgBId}`)
      .set('Authorization', `Bearer ${actorOrgAToken}`)
      .send({ title: 'Cross org patch attempt' });

    expect(res.status).toBe(404);
  });

  it('active org A user cannot DELETE test from org B', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/tests/${testOrgBId}`)
      .set('Authorization', `Bearer ${actorOrgAToken}`);

    expect(res.status).toBe(404);
  });

  it('active org A user cannot assign org B test to org A class', async () => {
    const openAt = new Date(Date.now() - 60_000).toISOString();
    const closeAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await request(app.getHttpServer())
      .post(`/tests/${testOrgBId}/assign`)
      .set('Authorization', `Bearer ${actorOrgAToken}`)
      .send({
        classSectionId: classSectionOrgAId,
        openAt,
        closeAt,
        maxAttempts: 1,
        shuffle: true,
        showExplain: 'after_close',
      });

    expect(res.status).toBe(404);
  });

  it('active org A user cannot assign org A test to org B class', async () => {
    const openAt = new Date(Date.now() - 60_000).toISOString();
    const closeAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await request(app.getHttpServer())
      .post(`/tests/${testOrgAId}/assign`)
      .set('Authorization', `Bearer ${actorOrgAToken}`)
      .send({
        classSectionId: classSectionOrgBId,
        openAt,
        closeAt,
        maxAttempts: 1,
        shuffle: true,
        showExplain: 'after_close',
      });

    expect(res.status).toBe(404);
  });

  it('active org A user cannot create assignment using org B class section', async () => {
    const res = await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${actorOrgAToken}`)
      .send({
        organizationId: orgAId,
        academicYearId: yearOrgAId,
        testId: testOrgAId,
        targetType: 'CLASS',
        classSectionId: classSectionOrgBId,
        openAt: new Date(Date.now() - 60_000).toISOString(),
        closeAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        maxAttempts: 1,
        shuffle: true,
        showExplain: 'after_close',
        createdById: actorMembershipOrgAId,
      });

    expect(res.status).toBe(404);
  });

  it('active org A user cannot create assignment using org B test', async () => {
    const res = await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${actorOrgAToken}`)
      .send({
        organizationId: orgAId,
        academicYearId: yearOrgAId,
        testId: testOrgBId,
        targetType: 'CLASS',
        classSectionId: classSectionOrgAId,
        openAt: new Date(Date.now() - 60_000).toISOString(),
        closeAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        maxAttempts: 1,
        shuffle: true,
        showExplain: 'after_close',
        createdById: actorMembershipOrgAId,
      });

    expect(res.status).toBe(404);
  });

  it('active org A user cannot PATCH assignment from org B', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/assignments/${assignmentOrgBId}`)
      .set('Authorization', `Bearer ${actorOrgAToken}`)
      .send({
        maxAttempts: 2,
      });

    expect(res.status).toBe(404);
  });

  it('active org A user cannot read test results from org B', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tests/${testOrgBId}/results`)
      .set('Authorization', `Bearer ${actorOrgAToken}`);

    expect(res.status).toBe(404);
  });

  it('assignment PATCH rejects class section from different academic year', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/assignments/${assignmentOrgBId}`)
      .set('Authorization', `Bearer ${directorOrgBToken}`)
      .send({
        classSectionId: classSectionOrgBOtherYearId,
      });

    expect(res.status).toBe(400);
    const body = unwrapBody(res) as { message?: string };
    expect(String(body?.message ?? '')).toContain('Assignment year mismatch');
  });
});
