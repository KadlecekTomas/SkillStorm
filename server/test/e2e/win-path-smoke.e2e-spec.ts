import { randomUUID } from 'crypto';
import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { authAs, uniqueEmail, useOrg } from 'test/helpers';
import {
  OrganizationRole,
  OrganizationStatus,
  PublishStatus,
  QuestionType,
  SchoolGrade,
} from '@prisma/client';

type AcademicYearApi = {
  id: string;
  organizationId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

type AuthMe = {
  organization?: { id?: string | null } | null;
  org?: { id?: string | null } | null;
};

type RegisterJoinResponse = {
  sessionToken: string;
  user: { id: string; email: string };
  membership: { id: string; organizationId: string; role: OrganizationRole };
  organization?: { id: string } | null;
};

type TestResultsResponse = {
  items: Array<{
    id: string;
    assignmentId: string;
    classSectionId: string | null;
    score: number | null;
    status?: string;
    correctCount?: number;
    incorrectCount?: number;
    pendingCount?: number;
  }>;
  meta?: {
    total: number;
  };
};

function suffix(seed: string): string {
  return `${seed}-${randomUUID().slice(0, 8)}`;
}

describe('Win path smoke (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('director -> teacher -> student -> results happy path is deterministic and complete', async () => {
    const runId = suffix('winpath');

    // 1) Director creates org and gets active membership context.
    const director = await authAs(app, OrganizationRole.DIRECTOR, {
      seed: `win_path_director_${runId}`,
      name: `Win Path Director ${runId}`,
    });
    const orgId = director.organization.id as string;
    const directorMembershipId = director.membership.id as string;

    await prisma.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    const directorToken = await useOrg(app, director.accessToken, orgId);

    // Deterministic active year lookup (idempotent): prefer existing current year, otherwise create one.
    const yearsRes = await request(app.getHttpServer())
      .get('/academic-years')
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);
    const years = yearsRes.body as AcademicYearApi[];
    let activeYear = years.find((year) => year.isActive) ?? null;

    if (!activeYear) {
      const nextStartYear = years.reduce((max, year) => {
        const startYear = Number.isNaN(Date.parse(year.startDate))
          ? 2030
          : new Date(year.startDate).getUTCFullYear();
        return Math.max(max, startYear + 1);
      }, 2030);

      const createYearRes = await request(app.getHttpServer())
        .post('/academic-years')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ startYear: nextStartYear, isActive: true })
        .expect(201);
      activeYear = createYearRes.body as AcademicYearApi;
    }

    const activeYearId = activeYear.id;

    // 2) Director creates class section in active year.
    const sectionSuffix = runId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
    const section = `W${sectionSuffix}`.slice(0, 5);
    const classCreateRes = await request(app.getHttpServer())
      .post('/class-sections')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        yearId: activeYearId,
        grade: SchoolGrade.GRADE_5,
        section,
        label: `5.${section}`,
      })
      .expect(201);

    const classSectionId = (classCreateRes.body as { id: string }).id;
    const classSectionYearId =
      (classCreateRes.body as { yearId?: string; academicYearId?: string }).yearId ??
      (classCreateRes.body as { academicYearId?: string }).academicYearId;
    expect(classSectionYearId).toBe(activeYearId);

    // 3) Director creates org subject (grade-compatible).
    const orgSubjectRes = await request(app.getHttpServer())
      .post('/org-subjects')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        name: `Matematika ${runId}`,
        gradeFrom: 5,
        gradeTo: 5,
        organizationId: orgId,
      })
      .expect(201);
    const orgSubjectId = (orgSubjectRes.body as { id: string }).id;
    // POST /tests expects the SUBJECT id (org link resolved via OrgSubject)
    const subjectIdForTest =
      (orgSubjectRes.body as { subjectId?: string; subject?: { id?: string } })
        .subjectId ??
      (orgSubjectRes.body as { subject?: { id?: string } }).subject?.id;
    expect(subjectIdForTest).toBeTruthy();

    // 4) Director attaches subject to class section and verifies list.
    await request(app.getHttpServer())
      .post(`/class-sections/${classSectionId}/org-subjects`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ orgSubjectIds: [orgSubjectId], replaceAll: true })
      .expect(201);

    const classSubjectsRes = await request(app.getHttpServer())
      .get(`/class-sections/${classSectionId}/org-subjects`)
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);
    const classSubjects = classSubjectsRes.body as Array<{ id: string; name: string }>;
    expect(classSubjects.some((subject) => subject.id === orgSubjectId)).toBe(true);

    // 5) Director creates student via invite flow + enrollment to class.
    const studentInviteRes = await request(app.getHttpServer())
      .post('/invites')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ type: 'ORG_ONLY', role: OrganizationRole.STUDENT })
      .expect(201);
    const studentInviteToken = (studentInviteRes.body as { inviteToken: string }).inviteToken;

    const studentRegisterEmail = uniqueEmail(`winpath_student_${runId}`);
    const studentRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: `Win Path Student ${runId}`,
        email: studentRegisterEmail,
        password: 'Password123!',
        mode: 'JOIN_ORG',
        inviteToken: studentInviteToken,
      })
      .expect(201);

    const studentRegister = studentRegisterRes.body as RegisterJoinResponse;
    expect(studentRegister.membership.organizationId).toBe(orgId);

    const studentToken = await useOrg(app, studentRegister.sessionToken, orgId);
    const studentMembershipId = studentRegister.membership.id;

    const studentRow = await prisma.student.findFirst({
      where: { membershipId: studentMembershipId, orgId },
      select: { id: true, orgId: true },
    });
    expect(studentRow?.orgId).toBe(orgId);
    const studentId = studentRow?.id;
    expect(studentId).toBeTruthy();

    const enrollmentRes = await request(app.getHttpServer())
      .post('/enrollments')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        studentId,
        classSectionId,
        yearId: activeYearId,
      })
      .expect(201);

    const enrollment = enrollmentRes.body as {
      id: string;
      studentId: string;
      classSectionId: string;
      yearId: string;
    };
    expect(enrollment.studentId).toBe(studentId);
    expect(enrollment.classSectionId).toBe(classSectionId);
    expect(enrollment.yearId).toBe(activeYearId);

    // 6) Teacher joins same org via invite.
    const teacherInviteRes = await request(app.getHttpServer())
      .post('/invites')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ type: 'ORG_ONLY', role: OrganizationRole.TEACHER })
      .expect(201);
    const teacherInviteToken = (teacherInviteRes.body as { inviteToken: string }).inviteToken;

    const teacherRegisterEmail = uniqueEmail(`winpath_teacher_${runId}`);
    const teacherRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: `Win Path Teacher ${runId}`,
        email: teacherRegisterEmail,
        password: 'Password123!',
        mode: 'JOIN_ORG',
        inviteToken: teacherInviteToken,
      })
      .expect(201);

    const teacherRegister = teacherRegisterRes.body as RegisterJoinResponse;
    expect(teacherRegister.membership.organizationId).toBe(orgId);

    const teacherToken = await useOrg(app, teacherRegister.sessionToken, orgId);

    // Results visibility is scoped to the teacher's classes — make the
    // teacher the homeroom teacher of the class section.
    const teacherEntity = await prisma.teacher.findFirst({
      where: {
        organizationId: orgId,
        membershipId: teacherRegister.membership.id,
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(teacherEntity).toBeTruthy();
    await prisma.classSection.update({
      where: { id: classSectionId },
      data: { teacherId: teacherEntity!.id },
    });

    // Invariant: all tokens are scoped to the same active org context.
    const meDirector = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);
    const meTeacher = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const meStudent = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const directorMe = meDirector.body as AuthMe;
    const teacherMe = meTeacher.body as AuthMe;
    const studentMe = meStudent.body as AuthMe;
    expect(directorMe.organization?.id ?? directorMe.org?.id).toBe(orgId);
    expect(teacherMe.organization?.id ?? teacherMe.org?.id).toBe(orgId);
    expect(studentMe.organization?.id ?? studentMe.org?.id).toBe(orgId);

    // 7) Teacher creates test under subject.
    const testCreateRes = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: `Win Path Test ${runId}`,
        subjectId: subjectIdForTest,
        allowedGrades: ['GRADE_5'],
      })
      .expect(201);
    const testId = (testCreateRes.body as { id: string }).id;

    // Assignability requires a topic assignment; build the minimal catalog
    // chain (CatalogSubject → CatalogTopic → SubjectLevel → TopicLevel) and
    // link the test to it.
    const catalogSubject = await prisma.catalogSubject.create({
      data: { code: `WPS_${runId}`, name: `WPS Catalog ${runId}` },
      select: { id: true },
    });
    const catalogTopic = await prisma.catalogTopic.create({
      data: { subjectId: catalogSubject.id, name: `WPS Topic ${runId}` },
      select: { id: true },
    });
    // org-subject provisioning already created levels for gradeFrom..gradeTo
    const subjectLevel =
      (await prisma.subjectLevel.findFirst({
        where: { subjectId: subjectIdForTest!, grade: 'GRADE_5' },
        select: { id: true },
      })) ??
      (await prisma.subjectLevel.create({
        data: { subjectId: subjectIdForTest!, grade: 'GRADE_5' },
        select: { id: true },
      }));
    const topicLevel = await prisma.topicLevel.create({
      data: {
        subjectLevelId: subjectLevel.id,
        catalogTopicId: catalogTopic.id,
      },
      select: { id: true },
    });
    await prisma.testAssignment.create({
      data: { testId, topicLevelId: topicLevel.id, isPrimary: true },
    });

    // 8) Teacher adds valid MC question + options (strict assignability).
    const questionRes = await request(app.getHttpServer())
      .post(`/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        text: 'Kolik je 2 + 2?',
        type: QuestionType.MULTIPLE_CHOICE,
        score: 2,
        order: 1,
        correctAnswer: '4',
      })
      .expect(201);
    const questionId = (questionRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions/${questionId}/options`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ text: '3' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions/${questionId}/options`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ text: '4' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions/${questionId}/options`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ text: '5' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions/${questionId}/options`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ text: '6' })
      .expect(201);

    // 9) Publish and verify backend-derived assignability is clean (all counters zero).
    const testDetailRes = await request(app.getHttpServer())
      .get(`/tests/${testId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    const testDetail = testDetailRes.body as {
      assignability?: {
        isAssignable: boolean;
        reasons: {
          missingQuestions: number;
          missingCorrectAnswers: number;
          invalidOptions: number;
          zeroPoints: number;
        };
      };
    };
    expect(testDetail.assignability?.isAssignable).toBe(true);
    expect(testDetail.assignability?.reasons).toEqual({
      missingAllowedGrades: 0,
      missingQuestions: 0,
      missingCorrectAnswers: 0,
      invalidOptions: 0,
      zeroPoints: 0,
      noTopicAssignments: 0,
    });

    await request(app.getHttpServer())
      .patch(`/tests/${testId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: PublishStatus.PUBLISHED })
      .expect(200);

    // 10) Teacher assigns test to class.
    const now = Date.now();
    const assignRes = await request(app.getHttpServer())
      .post(`/tests/${testId}/assign`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        classSectionId,
        openAt: new Date(now - 60_000).toISOString(),
        closeAt: new Date(now + 60 * 60 * 1000).toISOString(),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'after_close',
      })
      .expect(201);

    const assignment = assignRes.body as {
      id: string;
      testId: string;
      classSectionId: string;
      yearId: string;
    };
    const assignmentId = assignment.id;
    expect(assignment.testId).toBe(testId);
    expect(assignment.classSectionId).toBe(classSectionId);
    expect(assignment.yearId).toBe(classSectionYearId);

    // Invariant: Assignment.yearId === ClassSection.yearId (API + DB).
    const assignmentDb = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        yearId: true,
        classSection: {
          select: { yearId: true },
        },
      },
    });
    expect(assignmentDb?.yearId).toBe(classSectionYearId);
    expect(assignmentDb?.classSection?.yearId).toBe(classSectionYearId);

    // 11) Student opens assignment list.
    const myAssignmentsRes = await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    const myAssignments = myAssignmentsRes.body as Array<{ id: string; testId: string }>;
    expect(myAssignments.some((item) => item.id === assignmentId)).toBe(true);

    // 12) Student submits correct response and finishes.
    const submissionCreateRes = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId })
      .expect(201);
    const submissionId = (submissionCreateRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .patch(`/submissions/${submissionId}/responses`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses: [{ questionId, givenText: '4' }] })
      .expect(200);

    const finishRes = await request(app.getHttpServer())
      .post(`/submissions/${submissionId}/finish`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({})
      .expect(200);

    const finished = finishRes.body as { id: string; status: string; score: number | null };
    expect(finished.id).toBe(submissionId);
    expect(finished.status).toBe('APPROVED');
    expect(finished.score).toBe(1);

    // 13) Teacher/director reads results and sees submission + score.
    const teacherResultsRes = await request(app.getHttpServer())
      .get(`/tests/${testId}/results`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const teacherResults = (teacherResultsRes.body?.data ?? teacherResultsRes.body) as TestResultsResponse;
    const teacherItems = teacherResults.items ?? [];

    const teacherResult = teacherItems.find((entry) => entry.id === submissionId);
    expect(teacherResult).toBeDefined();
    expect(teacherResult?.assignmentId).toBe(assignmentId);
    expect(teacherResult?.classSectionId).toBe(classSectionId);
    // results items carry earned points (MC question worth 2), while
    // finish returns the normalized 0..1 score asserted above
    expect(teacherResult?.score).toBe(2);
    expect(teacherResult?.status).toBe('APPROVED');
    expect(teacherResult?.correctCount).toBe(1);
    expect(teacherResult?.incorrectCount).toBe(0);
    expect(teacherResult?.pendingCount).toBe(0);
    expect(teacherResults.meta?.total).toBeGreaterThanOrEqual(1);

    const directorResultsRes = await request(app.getHttpServer())
      .get(`/tests/${testId}/results`)
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);
    const directorResults = (directorResultsRes.body?.data ?? directorResultsRes.body) as TestResultsResponse;
    expect((directorResults.items ?? []).some((entry) => entry.id === submissionId)).toBe(true);

    // Keep these explicit so smoke clearly proves the requested path artifacts exist.
    expect(directorMembershipId).toBeTruthy();
    expect(activeYearId).toBeTruthy();
  });
});
