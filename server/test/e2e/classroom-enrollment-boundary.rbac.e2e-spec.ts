import { INestApplication } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import {
  ActivityCurriculumMappingStatus,
  ActivityCurriculumMappingType,
  ActivityDeliveryMode,
  EnrollmentStatus,
  LessonExperienceCurriculumMappingStatus,
  LiveSessionCommandType,
  LiveSessionMode,
  MappingProposerType,
  OrganizationRole,
  OrganizationStatus,
  SchoolGrade,
} from '@prisma/client';
import { AppModule } from '@/app.module';
import { ActivityService } from '@/activity-engine/activity.service';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { ClassroomOrchestrationService } from '@/classroom-orchestration/classroom-orchestration.service';
import { ClassroomStudentAccessService } from '@/classroom-orchestration/classroom-student-access.service';
import { CurriculumService } from '@/curriculum/curriculum.service';
import { LessonExperienceService } from '@/lesson-experience/lesson-experience.service';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext } from 'test/helpers';
import {
  createLessonFrameworkFixture,
  lessonActivityVersionInput,
  lessonPlatformActor,
  lessonPrimaryMapping,
  lessonSchoolActor,
  lessonVersionInput,
} from 'test/lesson-experience-fixtures';

const MODES = [ActivityDeliveryMode.DEVICES];

function studentContext(
  organizationId: string,
  membershipId: string,
  activeAcademicYearId: string,
): OrgContext {
  return {
    organizationId,
    membershipId,
    role: OrganizationRole.STUDENT,
    activeAcademicYearId,
    isAcademicYearExpired: false,
  };
}

describe('classroom enrollment boundary RBAC (PostgreSQL e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let classroom: ClassroomOrchestrationService;
  let access: ClassroomStudentAccessService;

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    classroom = app.get(ClassroomOrchestrationService);
    access = app.get(ClassroomStudentAccessService);
    const curriculum = app.get(CurriculumService);
    const activities = app.get(ActivityService);
    const lessons = app.get(LessonExperienceService);
    await prisma.$connect();

    const seed = `classroom_boundary_${Date.now()}`;
    const primary = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed,
    });
    const organizationId = primary.organization.id;
    await prisma.organization.update({
      where: { id: organizationId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    const platform = lessonPlatformActor(primary);
    const author = lessonSchoolActor(primary);
    const framework = await createLessonFrameworkFixture(
      curriculum,
      platform,
      `CLASSROOM-BOUNDARY-${seed}`,
    );

    const activity = await activities.createOrganizationActivity(
      {
        slug: `classroom-boundary-activity-${seed}`,
        title: 'Classroom boundary Activity',
      },
      author,
    );
    const activityInput = lessonActivityVersionInput('Classroom boundary Activity');
    activityInput.supportedModes = [...MODES];
    activityInput.recommendedMode = ActivityDeliveryMode.DEVICES;
    activityInput.modePolicy = {
      [ActivityDeliveryMode.DEVICES]: {
        preservesObjective: true,
        evidenceEquivalent: true,
        fallback: 'Individual student devices.',
      },
    };
    const activityVersion = await activities.createVersion(activity.id, activityInput, author);
    const activityMapping = await activities.proposeMapping(
      activityVersion.id,
      {
        frameworkOutcomeId: framework.outcomeId,
        outcomeAspectId: framework.aspectId,
        mappingType: ActivityCurriculumMappingType.PRIMARY,
        rationale: 'RBAC fixture validates an authentic published activity.',
        proposedByType: MappingProposerType.HUMAN,
      },
      author,
    );
    await activities.submitForReview(activityVersion.id, author);
    await activities.reviewMapping(
      activityMapping.id,
      {
        status: ActivityCurriculumMappingStatus.APPROVED,
        rationale: 'Approved for classroom enrollment RBAC fixture.',
      },
      author,
    );
    await activities.publish(activityVersion.id, author);

    const lesson = await lessons.createOrganizationLesson(
      {
        slug: `classroom-boundary-lesson-${seed}`,
        title: 'Classroom boundary Lesson',
      },
      author,
    );
    const lessonInput = lessonVersionInput(activityVersion.id, 'Classroom boundary Lesson');
    lessonInput.supportedModes = [...MODES];
    lessonInput.recommendedMode = ActivityDeliveryMode.DEVICES;
    const lessonVersion = await lessons.createVersion(lesson.id, lessonInput, author);
    const lessonMapping = await lessons.proposeMapping(
      lessonVersion.id,
      lessonPrimaryMapping(framework.outcomeId, framework.aspectId),
      author,
    );
    await lessons.submitForReview(lessonVersion.id, author);
    await lessons.reviewMapping(
      lessonMapping.id,
      {
        status: LessonExperienceCurriculumMappingStatus.APPROVED,
        rationale: 'Approved for classroom enrollment RBAC fixture.',
      },
      author,
    );
    const publishedLesson = await lessons.publish(lessonVersion.id, author);

    const year = await prisma.academicYear.findFirstOrThrow({
      where: { orgId: organizationId, isCurrent: true },
      select: { id: true },
    });
    const [class8A, class8B] = await Promise.all([
      prisma.classSection.create({
        data: {
          orgId: organizationId,
          yearId: year.id,
          grade: SchoolGrade.GRADE_8,
          section: 'A',
        },
        select: { id: true },
      }),
      prisma.classSection.create({
        data: {
          orgId: organizationId,
          yearId: year.id,
          grade: SchoolGrade.GRADE_8,
          section: 'B',
        },
        select: { id: true },
      }),
    ]);

    async function createEnrolledStudent(label: string, classSectionId: string) {
      const user = await prisma.user.create({
        data: {
          email: `${label}.${seed}@example.test`,
          username: `${label}_${seed}`,
          passwordHash: 'not-used-by-service-level-e2e',
          name: label,
        },
        select: { id: true },
      });
      const membership = await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId,
          role: OrganizationRole.STUDENT,
        },
        select: { id: true },
      });
      const student = await prisma.student.create({
        data: { membershipId: membership.id, orgId: organizationId },
        select: { id: true },
      });
      const enrollment = await prisma.enrollment.create({
        data: {
          studentId: student.id,
          classSectionId,
          yearId: year.id,
          orgId: organizationId,
          status: EnrollmentStatus.ACTIVE,
        },
        select: { id: true },
      });
      return {
        ctx: studentContext(organizationId, membership.id, year.id),
        enrollmentId: enrollment.id,
      };
    }

    const enrolled8A = await createEnrolledStudent('student8a', class8A.id);
    const enrolled8B = await createEnrolledStudent('student8b', class8B.id);
    const directorCtx: OrgContext = {
      organizationId,
      membershipId: primary.owner.membership.id,
      role: OrganizationRole.DIRECTOR,
      activeAcademicYearId: year.id,
      isAcademicYearExpired: false,
    };

    const classBoundSession = await classroom.createLessonSession(
      {
        lessonExperienceVersionId: publishedLesson.id,
        mode: LiveSessionMode.DEVICES,
        classSectionId: class8A.id,
      },
      directorCtx,
    );

    await expect(
      access.assertCanAccessSession(classBoundSession.id, enrolled8A.ctx),
    ).resolves.toBeUndefined();
    await expect(
      access.assertCanAccessSession(classBoundSession.id, enrolled8B.ctx),
    ).rejects.toMatchObject({ status: 404 });

    // Discovery is intentionally silent while the teacher is still preparing a DRAFT.
    await expect(access.findActiveSession(enrolled8A.ctx)).resolves.toBeNull();
    await expect(access.findActiveSession(enrolled8B.ctx)).resolves.toBeNull();

    await classroom.command(
      classBoundSession.id,
      {
        commandId: `start-${seed}`,
        type: LiveSessionCommandType.START,
        expectedRevision: 0,
      },
      directorCtx,
    );

    // Once RUNNING, only the enrolled 8.A student discovers the live lesson.
    await expect(access.findActiveSession(enrolled8A.ctx)).resolves.toMatchObject({
      id: classBoundSession.id,
      status: 'RUNNING',
      classSectionId: class8A.id,
    });
    await expect(access.findActiveSession(enrolled8B.ctx)).resolves.toBeNull();

    await prisma.enrollment.update({
      where: { id: enrolled8A.enrollmentId },
      data: { status: EnrollmentStatus.LEFT },
    });
    await expect(
      access.assertCanAccessSession(classBoundSession.id, enrolled8A.ctx),
    ).rejects.toMatchObject({ status: 404 });
    await expect(access.findActiveSession(enrolled8A.ctx)).resolves.toBeNull();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('enforces exact ACTIVE class enrollment and live discovery against PostgreSQL', () => {
    expect(true).toBe(true);
  });
});
