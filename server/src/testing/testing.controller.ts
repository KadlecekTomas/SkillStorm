import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { PrismaService } from '@/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

type GoldenFlowFixtureInput = {
  orgName: string;
  ownerEmail: string;
  teacherEmail: string;
  studentEmail: string;
  password: string;
  teacherName: string;
  studentName: string;
  classLabel: string;
  classSection: string;
  catalogSubjectCode: string;
  catalogSubjectName: string;
  catalogTopicName: string;
  testTitle: string;
  testDescription: string;
  questionOneText: string;
  questionTwoText: string;
  questionTwoCorrectAnswer: string;
  questionTwoIncorrectAnswer: string;
};

type GoldenFlowSeedResult = {
  orgId: string;
  academicYearId: string;
  ownerMembershipId: string;
  teacherMembershipId: string;
  studentMembershipId: string;
  subjectId: string;
  orgSubjectId: string;
  topicLevelId: string;
  catalogTopicId: string;
  classSectionId: string;
};

@ApiExcludeController()
@Controller('testing/golden-flow')
export class TestingController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('seed')
  @Public()
  async seed(
    @Headers('x-e2e-token') token: string | undefined,
    @Body() fixture: GoldenFlowFixtureInput,
  ): Promise<GoldenFlowSeedResult> {
    this.assertAuthorized(token);
    this.assertFixture(fixture);
    await this.cleanupFixture(fixture);

    const passwordHash = await bcrypt.hash(fixture.password, 10);

    const catalogSubject = await this.prisma.catalogSubject.create({
      data: {
        code: fixture.catalogSubjectCode,
        name: fixture.catalogSubjectName,
      },
    });

    const catalogTopic = await this.prisma.catalogTopic.create({
      data: {
        subjectId: catalogSubject.id,
        name: fixture.catalogTopicName,
      },
    });

    const subject = await this.prisma.subject.create({
      data: {
        catalogSubjectId: catalogSubject.id,
        name: fixture.catalogSubjectName,
        gradeFrom: 1,
        gradeTo: 9,
      },
      select: { id: true },
    });

    const subjectLevel = await this.prisma.subjectLevel.create({
      data: {
        subjectId: subject.id,
        grade: 'GRADE_7',
        order: 1,
        label: '7. ročník',
        isEnabled: true,
      },
      select: { id: true },
    });

    const owner = await this.prisma.user.create({
      data: {
        email: fixture.ownerEmail,
        username: 'goldenowner',
        name: 'Golden Owner',
        passwordHash,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const teacher = await this.prisma.user.create({
      data: {
        email: fixture.teacherEmail,
        username: 'goldenteacher',
        name: fixture.teacherName,
        passwordHash,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const student = await this.prisma.user.create({
      data: {
        email: fixture.studentEmail,
        username: 'goldenstudent',
        name: fixture.studentName,
        passwordHash,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const org = await this.prisma.organization.create({
      data: {
        name: fixture.orgName,
        city: 'Prague',
        country: 'CZ',
        type: 'SCHOOL',
        status: 'ACTIVE',
        ownerUserId: owner.id,
      },
      select: { id: true },
    });

    const academicYear = await this.prisma.academicYear.create({
      data: {
        orgId: org.id,
        label: '2025/2026',
        startsAt: new Date('2025-09-01T00:00:00.000Z'),
        endsAt: new Date('2026-06-30T23:59:59.000Z'),
        isCurrent: true,
      },
      select: { id: true },
    });

    const ownerMembership = await this.prisma.membership.create({
      data: { userId: owner.id, organizationId: org.id, role: 'OWNER' },
      select: { id: true },
    });
    const teacherMembership = await this.prisma.membership.create({
      data: { userId: teacher.id, organizationId: org.id, role: 'TEACHER' },
      select: { id: true },
    });
    const studentMembership = await this.prisma.membership.create({
      data: { userId: student.id, organizationId: org.id, role: 'STUDENT' },
      select: { id: true },
    });

    await this.prisma.user.update({
      where: { id: owner.id },
      data: { lastActiveMembershipId: ownerMembership.id },
    });
    await this.prisma.user.update({
      where: { id: teacher.id },
      data: { lastActiveMembershipId: teacherMembership.id },
    });
    await this.prisma.user.update({
      where: { id: student.id },
      data: { lastActiveMembershipId: studentMembership.id },
    });

    const orgSubject = await this.prisma.orgSubject.create({
      data: {
        organizationId: org.id,
        subjectId: subject.id,
        isEnabled: true,
        isCustom: false,
      },
      select: { id: true },
    });

    const teacherRow = await this.prisma.teacher.create({
      data: {
        membershipId: teacherMembership.id,
        organizationId: org.id,
      },
      select: { id: true },
    });

    await this.prisma.teacherSubject.create({
      data: {
        teacherId: teacherRow.id,
        subjectId: subject.id,
      },
    });

    const classSection = await this.prisma.classSection.create({
      data: {
        orgId: org.id,
        yearId: academicYear.id,
        grade: 'GRADE_7',
        section: fixture.classSection,
        label: fixture.classLabel,
        teacherId: teacherRow.id,
      },
      select: { id: true },
    });

    await this.prisma.teacherClassSection.create({
      data: {
        teacherId: teacherRow.id,
        classSectionId: classSection.id,
        yearId: academicYear.id,
      },
    });

    await this.prisma.classSectionOrgSubject.create({
      data: {
        classSectionId: classSection.id,
        orgSubjectId: orgSubject.id,
      },
    });

    const studentRow = await this.prisma.student.create({
      data: {
        membershipId: studentMembership.id,
        orgId: org.id,
      },
      select: { id: true },
    });

    await this.prisma.enrollment.create({
      data: {
        studentId: studentRow.id,
        classSectionId: classSection.id,
        yearId: academicYear.id,
        orgId: org.id,
        status: 'ACTIVE',
      },
    });

    const topicLevel = await this.prisma.topicLevel.create({
      data: {
        subjectLevelId: subjectLevel.id,
        catalogTopicId: catalogTopic.id,
        name: fixture.catalogTopicName,
        phase: 'INTRO',
        difficulty: 'BASIC',
        order: 1,
      },
      select: { id: true },
    });

    return {
      orgId: org.id,
      academicYearId: academicYear.id,
      ownerMembershipId: ownerMembership.id,
      teacherMembershipId: teacherMembership.id,
      studentMembershipId: studentMembership.id,
      subjectId: subject.id,
      orgSubjectId: orgSubject.id,
      topicLevelId: topicLevel.id,
      catalogTopicId: catalogTopic.id,
      classSectionId: classSection.id,
    };
  }

  @Delete('fixture')
  @Public()
  async cleanup(
    @Headers('x-e2e-token') token: string | undefined,
    @Body() fixture: GoldenFlowFixtureInput,
  ): Promise<{ cleaned: true }> {
    this.assertAuthorized(token);
    this.assertFixture(fixture);
    await this.cleanupFixture(fixture);
    return { cleaned: true };
  }

  @Post('tests/:testId/topic-assignment')
  @Public()
  async attachTopicAssignment(
    @Headers('x-e2e-token') token: string | undefined,
    @Param('testId') testId: string,
    @Body() body: { topicLevelId?: string },
  ): Promise<{ attached: true }> {
    this.assertAuthorized(token);
    if (!body?.topicLevelId) throw new BadRequestException('topicLevelId is required');
    await this.prisma.testAssignment.create({
      data: {
        testId,
        topicLevelId: body.topicLevelId,
        isPrimary: true,
        order: 1,
      },
    });
    return { attached: true };
  }

  @Get('tests/:testId')
  @Public()
  async getTest(
    @Headers('x-e2e-token') token: string | undefined,
    @Param('testId') testId: string,
    @Query('creatorId') creatorId: string,
    @Query('title') title: string,
  ) {
    this.assertAuthorized(token);
    return this.prisma.test.findFirst({
      where: {
        id: testId,
        creatorId,
        title,
      },
      include: {
        questions: { select: { id: true } },
      },
    });
  }

  @Get('assignments/by-test/:testId')
  @Public()
  async getAssignment(
    @Headers('x-e2e-token') token: string | undefined,
    @Param('testId') testId: string,
    @Query('classSectionId') classSectionId: string,
    @Query('organizationId') organizationId: string,
  ) {
    this.assertAuthorized(token);
    return this.prisma.assignment.findFirst({
      where: {
        testId,
        classSectionId,
        organizationId,
      },
      select: {
        id: true,
        openAt: true,
        closeAt: true,
      },
    });
  }

  @Patch('assignments/:assignmentId/close')
  @Public()
  async closeAssignment(
    @Headers('x-e2e-token') token: string | undefined,
    @Param('assignmentId') assignmentId: string,
  ) {
    this.assertAuthorized(token);
    return this.prisma.assignment.update({
      where: { id: assignmentId },
      data: { closeAt: new Date(Date.now() - 60_000) },
      select: { id: true, closeAt: true },
    });
  }

  @Get('submissions/:submissionId')
  @Public()
  async getSubmission(
    @Headers('x-e2e-token') token: string | undefined,
    @Param('submissionId') submissionId: string,
  ) {
    this.assertAuthorized(token);
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        responses: {
          orderBy: { createdAt: 'asc' },
          select: { isCorrect: true },
        },
      },
    });
    if (!submission) throw new NotFoundException('submission not found');
    return submission;
  }

  private assertAuthorized(token: string | undefined): void {
    const expected = process.env.E2E_TEST_TOKEN ?? process.env.METRICS_INGEST_KEY;
    if (!expected || token !== expected) {
      throw new ForbiddenException('E2E testing endpoint is disabled');
    }
  }

  private assertFixture(fixture: Partial<GoldenFlowFixtureInput> | undefined): asserts fixture is GoldenFlowFixtureInput {
    if (!fixture?.orgName || !fixture.ownerEmail || !fixture.teacherEmail || !fixture.studentEmail) {
      throw new BadRequestException('fixture payload is incomplete');
    }
  }

  private async cleanupFixture(fixture: GoldenFlowFixtureInput): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { email: { in: [fixture.ownerEmail, fixture.teacherEmail, fixture.studentEmail] } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);

    const orgs = await this.prisma.organization.findMany({
      where: {
        OR: [
          { name: fixture.orgName },
          { ownerUserId: { in: userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'] } },
        ],
      },
      select: { id: true },
    });
    const orgIds = orgs.map((org) => org.id);

    if (orgIds.length) {
      await this.prisma.submission.deleteMany({ where: { organizationId: { in: orgIds } } });
      await this.prisma.assignmentStudent.deleteMany({ where: { assignment: { organizationId: { in: orgIds } } } });
      await this.prisma.assignment.deleteMany({ where: { organizationId: { in: orgIds } } });
      await this.prisma.testAssignment.deleteMany({ where: { test: { organizationId: { in: orgIds } } } });
      await this.prisma.answer.deleteMany({ where: { question: { test: { organizationId: { in: orgIds } } } } });
      await this.prisma.option.deleteMany({ where: { question: { test: { organizationId: { in: orgIds } } } } });
      await this.prisma.question.deleteMany({ where: { test: { organizationId: { in: orgIds } } } });
      await this.prisma.test.deleteMany({ where: { organizationId: { in: orgIds } } });
      await this.prisma.teacherSubject.deleteMany({ where: { teacher: { organizationId: { in: orgIds } } } });
      await this.prisma.teacherClassSection.deleteMany({ where: { academicYear: { orgId: { in: orgIds } } } });
      await this.prisma.enrollment.deleteMany({ where: { orgId: { in: orgIds } } });
      await this.prisma.student.deleteMany({ where: { orgId: { in: orgIds } } });
      await this.prisma.teacher.deleteMany({ where: { organizationId: { in: orgIds } } });
      await this.prisma.classSectionOrgSubject.deleteMany({ where: { classSection: { orgId: { in: orgIds } } } });
      await this.prisma.classSection.deleteMany({ where: { orgId: { in: orgIds } } });
      await this.prisma.orgSubject.deleteMany({ where: { organizationId: { in: orgIds } } });
      await this.prisma.membership.deleteMany({ where: { organizationId: { in: orgIds } } });
      await this.prisma.academicYear.deleteMany({ where: { orgId: { in: orgIds } } });
      await this.prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }

    if (userIds.length) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      await this.prisma.revokedToken.deleteMany({ where: { userId: { in: userIds } } });
      await this.prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
      await this.prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    const catalogSubject = await this.prisma.catalogSubject.findUnique({
      where: { code: fixture.catalogSubjectCode },
      select: { id: true },
    });

    if (catalogSubject) {
      await this.prisma.topicLevel.deleteMany({ where: { catalogTopic: { subjectId: catalogSubject.id } } });
      await this.prisma.subjectLevel.deleteMany({ where: { subject: { catalogSubjectId: catalogSubject.id } } });
      await this.prisma.subject.deleteMany({ where: { catalogSubjectId: catalogSubject.id } });
      await this.prisma.catalogTopic.deleteMany({ where: { subjectId: catalogSubject.id } });
      await this.prisma.catalogSubject.delete({ where: { id: catalogSubject.id } });
    }
  }
}
