// test/e2e/teacher-class-scope.e2e-spec.ts
/**
 * teacherClassScope — audit homeroom-only RBAC (viz docs/visual-qa-findings.md)
 *
 * „Učí třídu" = homeroom (ClassSection.teacherId) NEBO aktivní úvazek
 * (TeacherClassSection: nesmazaný, uvnitř platnostního okna). Před opravou
 * datové scope a guardy počítaly jen s homeroomem — učitel s platným úvazkem
 * neviděl detail žáka ani odevzdání své třídy.
 *
 * A. GET /students/:id/detail (StudentAccessGuard):
 *    homeroom 200 · aktivní úvazek 200 · expirovaný úvazek 403 ·
 *    smazaný úvazek 403 · učitel bez vztahu 403
 * B. GET /submissions/:id (teacherClassScope v datovém scope):
 *    aktivní úvazek 200 (není tvůrce zadání ani homeroom) ·
 *    expirovaný úvazek 403 · homeroom 200 (regrese)
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import * as request from 'supertest';
import { $Enums, OrganizationStatus } from '@prisma/client';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext } from 'test/helpers';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('teacherClassScope — úvazky v RBAC a datovém scope (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId: string;
  let yearId: string;
  let studentRecordId: string;
  let submissionId: string;

  let homeroomToken: string;
  let subjectToken: string; // aktivní úvazek, ne homeroom
  let expiredToken: string; // úvazek s validTo v minulosti
  let deletedToken: string; // soft-smazaný úvazek
  let outsiderToken: string; // učitel bez vztahu ke třídě
  let userIds: string[];

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$connect();

    const ts = Date.now();
    const ctx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `scope_${ts}`,
      with: { teacher: true, student: true },
    });
    orgId = ctx.organization.id;

    const subject = await ctx.addMember('TEACHER' as any, 'subject');
    const expired = await ctx.addMember('TEACHER' as any, 'expired');
    const deleted = await ctx.addMember('TEACHER' as any, 'deleted');
    const outsider = await ctx.addMember('TEACHER' as any, 'outsider');

    homeroomToken = ctx.teacher!.accessToken;
    subjectToken = subject.accessToken;
    expiredToken = expired.accessToken;
    deletedToken = deleted.accessToken;
    outsiderToken = outsider.accessToken;
    userIds = [
      ctx.owner.user.id,
      ctx.actor.user.id,
      ctx.teacher!.user.id,
      ctx.student!.user.id,
      subject.user.id,
      expired.user.id,
      deleted.user.id,
      outsider.user.id,
    ];

    await prisma.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    const year = await prisma.academicYear.findFirstOrThrow({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    yearId = year.id;

    // Teacher záznamy (bootstrap membershipů je nemusí vytvářet)
    const ensureTeacher = async (membershipId: string) => {
      const existing = await prisma.teacher.findFirst({
        where: { membershipId },
        select: { id: true },
      });
      if (existing) return existing.id;
      const created = await prisma.teacher.create({
        data: { membershipId, organizationId: orgId },
        select: { id: true },
      });
      return created.id;
    };
    const homeroomTeacherId = await ensureTeacher(ctx.teacher!.membership.id);
    const subjectTeacherId = await ensureTeacher(subject.membership.id);
    const expiredTeacherId = await ensureTeacher(expired.membership.id);
    const deletedTeacherId = await ensureTeacher(deleted.membership.id);
    await ensureTeacher(outsider.membership.id);

    const classSection = await prisma.classSection.create({
      data: {
        orgId,
        yearId,
        grade: $Enums.SchoolGrade.GRADE_6,
        section: 'S',
        teacherId: homeroomTeacherId, // homeroom = třídnictví
      },
      select: { id: true },
    });

    // Úvazky: aktivní / expirovaný / soft-smazaný
    await prisma.teacherClassSection.createMany({
      data: [
        {
          teacherId: subjectTeacherId,
          classSectionId: classSection.id,
          yearId,
          validFrom: new Date(Date.now() - 30 * DAY_MS),
          validTo: null,
        },
        {
          teacherId: expiredTeacherId,
          classSectionId: classSection.id,
          yearId,
          validFrom: new Date(Date.now() - 60 * DAY_MS),
          validTo: new Date(Date.now() - DAY_MS),
        },
        {
          teacherId: deletedTeacherId,
          classSectionId: classSection.id,
          yearId,
          deletedAt: new Date(),
        },
      ],
    });

    const studentRecord = await prisma.student.create({
      data: { membershipId: ctx.student!.membership.id, orgId },
      select: { id: true },
    });
    studentRecordId = studentRecord.id;
    await prisma.enrollment.create({
      data: {
        studentId: studentRecord.id,
        classSectionId: classSection.id,
        yearId,
        orgId,
        status: $Enums.EnrollmentStatus.ACTIVE,
      },
    });

    // Zadání vytvořil HOMEROOM učitel — subject/expired nejsou tvůrci,
    // k odevzdání se dostanou jedině přes teacherClassScope.
    const test = await prisma.test.create({
      data: {
        organizationId: orgId,
        academicYearId: yearId,
        title: 'Scope fixture',
        creatorId: ctx.teacher!.membership.id,
        status: $Enums.PublishStatus.PUBLISHED,
        publishedAt: new Date(),
        questions: {
          create: [
            {
              text: 'Q1',
              type: $Enums.QuestionType.TRUE_FALSE,
              correctAnswer: 'true',
              order: 1,
            },
          ],
        },
      },
      select: { id: true },
    });
    const assignment = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId,
        testId: test.id,
        targetType: 'CLASS',
        classSectionId: classSection.id,
        openAt: new Date(Date.now() - 60_000),
        closeAt: new Date(Date.now() + 3_600_000),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: ctx.teacher!.membership.id,
      },
      select: { id: true },
    });
    const submission = await prisma.submission.create({
      data: {
        organizationId: orgId,
        studentId: ctx.student!.membership.id,
        testId: test.id,
        assignmentId: assignment.id,
        status: $Enums.SubmissionStatus.PENDING,
        submittedAt: new Date(),
      },
      select: { id: true },
    });
    submissionId = submission.id;
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.submission.deleteMany({ where: { organizationId: orgId } });
      await prisma.assignment.deleteMany({ where: { organizationId: orgId } });
      await prisma.question.deleteMany({
        where: { test: { organizationId: orgId } },
      });
      await prisma.test.deleteMany({ where: { organizationId: orgId } });
      await prisma.enrollment.deleteMany({ where: { orgId } });
      await prisma.student.deleteMany({ where: { orgId } });
      await prisma.teacherClassSection.deleteMany({
        where: { classSection: { orgId } },
      });
      await prisma.classSection.deleteMany({ where: { orgId } });
      await prisma.teacher.deleteMany({ where: { organizationId: orgId } });
      await prisma.membership.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    if (userIds?.length) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  const getDetail = (token: string) =>
    api()
      .get(`/students/${studentRecordId}/detail`)
      .set('Authorization', `Bearer ${token}`);

  const getSubmission = (token: string) =>
    api()
      .get(`/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${token}`);

  it('A: detail žáka — homeroom i aktivní úvazek ano, expirovaný/smazaný/bez vztahu ne', async () => {
    await getDetail(homeroomToken).expect(200);
    // JÁDRO OPRAVY: učitel s aktivním úvazkem (ne třídní) žáka vidí
    await getDetail(subjectToken).expect(200);
    await getDetail(expiredToken).expect(403);
    await getDetail(deletedToken).expect(403);
    await getDetail(outsiderToken).expect(403);
  });

  it('B: odevzdání — aktivní úvazek čte submission třídy, expirovaný ne', async () => {
    await getSubmission(homeroomToken).expect(200);
    // JÁDRO OPRAVY: není tvůrce zadání ani homeroom, ale třídu aktivně učí
    await getSubmission(subjectToken).expect(200);
    await getSubmission(expiredToken).expect(403);
    await getSubmission(outsiderToken).expect(403);
  });
});
