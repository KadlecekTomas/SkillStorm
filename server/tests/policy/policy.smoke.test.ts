import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../../src/main';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RbacService } from '../../src/modules/rbac/rbac.service';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../../src/auth/token-cookies';
import { policyCheck } from './policy.score';
import type { PolicySeedContext, SeededMember } from './seed.util';
import { seedPolicyData } from './seed.util';
import { createHash } from 'crypto';
import {
  OrganizationRole,
  PermissionKey,
  SubmissionStatus,
  SubscriptionStatus,
  ContentScope,
} from '@prisma/client';

interface AuthFlowState {
  registerEmail: string;
  registerPassword: string;
  refreshTokenFromRegister: string | null;
  loginAccessToken: string | null;
  loginRefreshToken: string | null;
  rotatedAccessToken: string | null;
  rotatedRefreshToken: string | null;
  userId: string | null;
  membershipId: string | null;
  organizationId: string | null;
  membershipRole: OrganizationRole | null;
}

function extractCookie(cookies: string[] | undefined, name: string) {
  if (!cookies) return null;
  const raw = cookies.find((entry) => entry.startsWith(`${name}=`));
  if (!raw) return null;
  const [_, value] = raw.split('=');
  return decodeURIComponent(value.split(';')[0] ?? '');
}

function hashToken(token: string | null | undefined) {
  if (!token) return null;
  return createHash('sha256').update(token).digest('hex');
}

async function loginUser(
  server: any,
  credentials: SeededMember,
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await request(server)
    .post('/auth/login')
    .send({
      login: credentials.user.email ?? credentials.user.username,
      password: credentials.password,
    });

  const cookies = response.get('set-cookie') ?? [];
  const accessToken = extractCookie(cookies, ACCESS_TOKEN_COOKIE) ?? '';
  const refreshToken = extractCookie(cookies, REFRESH_TOKEN_COOKIE) ?? '';

  if (!accessToken || !refreshToken) {
    console.warn(
      `⚠️ [Policy] Missing auth cookies for seeded user ${credentials.user.email ?? credentials.user.id}.` +
        ' Subsequent policy checks may fail due to unauthorized requests.',
    );
  }

  return { accessToken, refreshToken };
}

let app: INestApplication;
let prisma: PrismaService;
let rbac: RbacService;
let server: ReturnType<INestApplication['getHttpServer']>;
let seed: PolicySeedContext;
const authFlow: AuthFlowState = {
  registerEmail: `policy-user-${Date.now()}@example.com`,
  registerPassword: 'PolicyReg#1234',
  refreshTokenFromRegister: null,
  loginAccessToken: null,
  loginRefreshToken: null,
  rotatedAccessToken: null,
  rotatedRefreshToken: null,
  userId: null,
  membershipId: null,
  organizationId: null,
  membershipRole: null,
};

let firstSubmissionId: string | null = null;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  app = await createApp();
  await app.init();
  prisma = app.get(PrismaService);
  rbac = app.get(RbacService);
  seed = await seedPolicyData(prisma);
  server = app.getHttpServer();
  rbac.invalidateAll?.();
});

afterAll(async () => {
  await app.close();
});

describe('Policy smoke suite', () => {
  describe('Auth & Membership policies', () => {
    beforeAll(async () => {
      const registerResponse = await request(server)
        .post('/auth/register')
        .send({
          name: 'Policy Compliance User',
          email: authFlow.registerEmail,
          password: authFlow.registerPassword,
          role: OrganizationRole.STUDENT,
        });
      if (process.env.DEBUG_POLICY === '1') {
        console.log(
          '[policy][register]',
          registerResponse.status,
          registerResponse.body,
        );
      }
      authFlow.userId = registerResponse.body?.user?.id ?? null;
      authFlow.membershipId = registerResponse.body?.membership?.id ?? null;
      authFlow.organizationId = registerResponse.body?.organization?.id ?? null;
      authFlow.membershipRole = registerResponse.body?.membership?.role ?? null;
      authFlow.refreshTokenFromRegister = extractCookie(
        registerResponse.get('set-cookie'),
        REFRESH_TOKEN_COOKIE,
      );

      const loginResponse = await request(server).post('/auth/login').send({
        login: authFlow.registerEmail,
        password: authFlow.registerPassword,
      });
      const loginCookies = loginResponse.get('set-cookie');
      authFlow.loginAccessToken = extractCookie(
        loginCookies,
        ACCESS_TOKEN_COOKIE,
      );
      authFlow.loginRefreshToken = extractCookie(
        loginCookies,
        REFRESH_TOKEN_COOKIE,
      );

      const refreshResponse = await request(server)
        .post('/auth/refresh')
        .send({ refreshToken: authFlow.loginRefreshToken });
      const refreshCookies = refreshResponse.get('set-cookie');
      authFlow.rotatedAccessToken = extractCookie(
        refreshCookies,
        ACCESS_TOKEN_COOKIE,
      );
      authFlow.rotatedRefreshToken = extractCookie(
        refreshCookies,
        REFRESH_TOKEN_COOKIE,
      );

      if (authFlow.rotatedAccessToken && authFlow.rotatedRefreshToken) {
        await request(server)
          .post('/auth/logout')
          .set('Authorization', `Bearer ${authFlow.rotatedAccessToken}`)
          .send({ refreshToken: authFlow.rotatedRefreshToken });
      }
    });

    it('registers user with expected membership role', async () => {
      await policyCheck(
        'Auth',
        'Register → membership role matches requested role',
        () => {
          expect(authFlow.membershipRole).toBe(OrganizationRole.STUDENT);
        },
      );
    });

    it('persists membership for registered user', async () => {
      await policyCheck(
        'Auth',
        'Register → membership persisted in DB',
        async () => {
          const membership = authFlow.membershipId
            ? await prisma.membership.findUnique({
                where: { id: authFlow.membershipId },
              })
            : null;
          expect(membership?.organizationId).toBe(authFlow.organizationId);
        },
      );
    });

    it('stores refresh token in plain token column', async () => {
      await policyCheck(
        'Auth',
        'Login → refresh token stored in `token` column',
        async () => {
          const row = authFlow.userId
            ? await prisma.refreshToken.findFirst({
                where: { userId: authFlow.userId },
              })
            : null;
          expect(row).toBeTruthy();
          expect((row as any)?.token).toBeDefined();
        },
      );
    });

    it('creates refresh token record on login', async () => {
      await policyCheck(
        'Auth',
        'Login → refresh token row created',
        async () => {
          const rows = authFlow.userId
            ? await prisma.refreshToken.findMany({
                where: { userId: authFlow.userId },
              })
            : [];
          expect(rows.length).toBeGreaterThanOrEqual(2);
        },
      );
    });

    it('rotates refresh token on /auth/refresh', async () => {
      await policyCheck(
        'Auth',
        'Refresh → previous token revoked',
        async () => {
          const hash = hashToken(authFlow.loginRefreshToken);
          const row = hash
            ? await prisma.refreshToken.findFirst({
                where: { tokenHash: hash },
              })
            : null;
          expect(row?.revokedAt).not.toBeNull();
          expect(authFlow.rotatedAccessToken).not.toBe(
            authFlow.loginAccessToken,
          );
        },
      );
    });

    it('revokes tokens on logout', async () => {
      await policyCheck(
        'Auth',
        'Logout → refresh + access token revoked',
        async () => {
          const revokedRefresh = hashToken(authFlow.rotatedRefreshToken);
          const refreshRow = revokedRefresh
            ? await prisma.refreshToken.findFirst({
                where: { tokenHash: revokedRefresh },
              })
            : null;
          const revokedAccess = authFlow.rotatedAccessToken
            ? await prisma.revokedToken.findFirst({
                where: { token: authFlow.rotatedAccessToken },
              })
            : null;
          expect(refreshRow?.revokedAt).not.toBeNull();
          expect(revokedAccess).toBeTruthy();
        },
      );
    });
  });

  // Additional describe blocks for RBAC, Multitenancy, Content, Tests, Submissions, Audit, Plans will follow...

  describe('RBAC policies', () => {
    const requiredKeys = [
      PermissionKey.CREATE_TEST,
      PermissionKey.EDIT_TEST,
      PermissionKey.DELETE_TEST,
      PermissionKey.VIEW_RESULTS,
      PermissionKey.MANAGE_STUDENTS,
      PermissionKey.MANAGE_TEACHERS,
    ];

    it('seeds permission catalog for critical policies', async () => {
      await policyCheck(
        'RBAC',
        'RBAC → required PermissionKey entries exist',
        async () => {
          const count = await prisma.permission.count({
            where: { key: { in: requiredKeys } },
          });
          expect(count).toBe(requiredKeys.length);
        },
      );
    });

    it('enforces teacher capabilities', async () => {
      await policyCheck('RBAC', 'Teacher → CREATE_TEST allowed', async () => {
        const allowed = await rbac.canUser(
          seed.users.teacher.user.id,
          seed.organizations.primary.id,
          PermissionKey.CREATE_TEST,
        );
        expect(allowed).toBe(true);
      });

      await policyCheck('RBAC', 'Teacher → EDIT_TEST allowed', async () => {
        const allowed = await rbac.canUser(
          seed.users.teacher.user.id,
          seed.organizations.primary.id,
          PermissionKey.EDIT_TEST,
        );
        expect(allowed).toBe(true);
      });

      await policyCheck('RBAC', 'Teacher → VIEW_RESULTS allowed', async () => {
        const allowed = await rbac.canUser(
          seed.users.teacher.user.id,
          seed.organizations.primary.id,
          PermissionKey.VIEW_RESULTS,
        );
        expect(allowed).toBe(true);
      });

      await policyCheck(
        'RBAC',
        'Teacher → DELETE_TEST denied by default',
        async () => {
          const allowed = await rbac.canUser(
            seed.users.teacher.user.id,
            seed.organizations.primary.id,
            PermissionKey.DELETE_TEST,
          );
          expect(allowed).toBe(false);
        },
      );

      await policyCheck(
        'RBAC',
        'Teacher → MANAGE_TEACHERS denied',
        async () => {
          const allowed = await rbac.canUser(
            seed.users.teacher.user.id,
            seed.organizations.primary.id,
            PermissionKey.MANAGE_TEACHERS,
          );
          expect(allowed).toBe(false);
        },
      );
    });

    it('grants director management permissions', async () => {
      await policyCheck(
        'RBAC',
        'Director → MANAGE_TEACHERS allowed',
        async () => {
          const allowed = await rbac.canUser(
            seed.users.director.user.id,
            seed.organizations.primary.id,
            PermissionKey.MANAGE_TEACHERS,
          );
          expect(allowed).toBe(true);
        },
      );

      await policyCheck(
        'RBAC',
        'Director → MANAGE_STUDENTS allowed',
        async () => {
          const allowed = await rbac.canUser(
            seed.users.director.user.id,
            seed.organizations.primary.id,
            PermissionKey.MANAGE_STUDENTS,
          );
          expect(allowed).toBe(true);
        },
      );
    });

    it('limits student and parent roles', async () => {
      await policyCheck('RBAC', 'Student → VIEW_RESULTS allowed', async () => {
        const allowed = await rbac.canUser(
          seed.users.student.user.id,
          seed.organizations.primary.id,
          PermissionKey.VIEW_RESULTS,
        );
        expect(allowed).toBe(true);
      });

      await policyCheck('RBAC', 'Student → CREATE_TEST denied', async () => {
        const allowed = await rbac.canUser(
          seed.users.student.user.id,
          seed.organizations.primary.id,
          PermissionKey.CREATE_TEST,
        );
        expect(allowed).toBe(false);
      });

      // Guardian invariant (docs/guardian.md §3–§4): PARENT nezískává generická
      // RBAC oprávnění. Dřívější „Parent → VIEW_RESULTS allowed" byl relikt
      // Etapy A; rodičovský přístup je nyní výhradně vztahový přes /guardian/*.
      await policyCheck('RBAC', 'Parent → VIEW_RESULTS denied', async () => {
        const allowed = await rbac.canUser(
          seed.users.parent.user.id,
          seed.organizations.primary.id,
          PermissionKey.VIEW_RESULTS,
        );
        expect(allowed).toBe(false);
      });

      await policyCheck(
        'RBAC',
        'Parent → no role_permissions rows (invariant)',
        async () => {
          const count = await prisma.rolePermission.count({
            where: { role: OrganizationRole.PARENT },
          });
          expect(count).toBe(0);
        },
      );
    });

    it('treats owner as wildcard', async () => {
      await policyCheck(
        'RBAC',
        'Owner → wildcard permissions enabled',
        async () => {
          const allowed = await rbac.canUser(
            seed.users.owner.user.id,
            seed.organizations.primary.id,
            PermissionKey.DELETE_TEST,
          );
          expect(allowed).toBe(true);
        },
      );
    });

    it('allows per-user permission overrides', async () => {
      await policyCheck(
        'RBAC',
        'UserPermission → extends privileges ad-hoc',
        async () => {
          const custom = await prisma.userPermission.create({
            data: {
              userId: seed.users.student.user.id,
              organizationId: seed.organizations.primary.id,
              permissionId:
                seed.rbac.permissions[PermissionKey.MANAGE_STUDENTS].id,
              allowed: true,
            },
          });
          rbac.invalidateAll?.();
          const allowed = await rbac.canUser(
            seed.users.student.user.id,
            seed.organizations.primary.id,
            PermissionKey.MANAGE_STUDENTS,
          );
          await prisma.userPermission.delete({ where: { id: custom.id } });
          rbac.invalidateAll?.();
          expect(allowed).toBe(true);
        },
      );
    });
  });

  describe('Multitenancy isolation', () => {
    let teacherTokens: { accessToken: string; refreshToken: string };
    let orgBTeacherTokens: { accessToken: string; refreshToken: string };

    beforeAll(async () => {
      teacherTokens = await loginUser(server, seed.users.teacher);
      orgBTeacherTokens = await loginUser(server, seed.users.orgBTeacher);
    });

    it('blocks cross-organization test reads', async () => {
      await policyCheck(
        'Multitenancy',
        'Org A teacher → cannot read Org B test',
        async () => {
          const res = await request(server)
            .get(`/tests/${seed.tests.orgBTest.id}`)
            .set('Authorization', `Bearer ${teacherTokens.accessToken}`);
          expect(res.status).toBe(403);
        },
      );
    });

    it('blocks cross-organization material reads for scoped resources', async () => {
      await policyCheck(
        'Multitenancy',
        'Org A teacher → cannot read Org B material',
        async () => {
          const res = await request(server)
            .get(`/learning-materials/${seed.content.orgBMaterial.id}`)
            .set('Authorization', `Bearer ${teacherTokens.accessToken}`);
          expect(res.status).toBe(403);
        },
      );
    });

    it('allows same-organization access', async () => {
      await policyCheck(
        'Multitenancy',
        'Org B teacher → can read its own test',
        async () => {
          const res = await request(server)
            .get(`/tests/${seed.tests.orgBTest.id}`)
            .set('Authorization', `Bearer ${orgBTeacherTokens.accessToken}`);
          expect(res.status).toBe(200);
        },
      );
    });
  });

  describe('Content & assignments', () => {
    let studentTokens: { accessToken: string; refreshToken: string };

    beforeAll(async () => {
      studentTokens = await loginUser(server, seed.users.student);
    });

    it('exposes global materials to local students', async () => {
      await policyCheck(
        'Content',
        'Global material → accessible inside primary org',
        async () => {
          const res = await request(server)
            .get(`/learning-materials/${seed.content.learningMaterial.id}`)
            .set('Authorization', `Bearer ${studentTokens.accessToken}`);
          expect(res.status).toBe(200);
        },
      );
    });

    it('shares global materials across organizations', async () => {
      await policyCheck(
        'Content',
        'Global material → accessible in other org',
        async () => {
          const tokens = await loginUser(server, seed.users.orgBTeacher);
          const res = await request(server)
            .get(`/learning-materials/${seed.content.learningMaterial.id}`)
            .set('Authorization', `Bearer ${tokens.accessToken}`);
          expect(res.status).toBe(200);
        },
      );
    });

    it('links material assignments to topic + class structure', async () => {
      await policyCheck(
        'Content',
        'MaterialAssignment → ties to topic level + grade',
        async () => {
          const assignment = await prisma.materialAssignment.findUnique({
            where: { id: seed.content.materialAssignment.id },
            include: {
              topicLevel: {
                include: { subjectLevel: true },
              },
              material: true,
            },
          });
          expect(assignment?.topicLevelId).toBe(seed.content.topicLevel.id);
          expect(assignment?.topicLevel.subjectLevel.grade).toBe(
            seed.academics.classSection.grade,
          );
          expect(assignment?.material.scope).toBe(ContentScope.GLOBAL);
        },
      );
    });
  });

  describe('Tests & scheduling', () => {
    it('maintains heterogenous question types', async () => {
      await policyCheck(
        'Tests',
        'Test → includes MCQ/TF/FITB questions',
        async () => {
          const test = await prisma.test.findUnique({
            where: { id: seed.tests.test.id },
            include: { questions: true },
          });
          const types = new Set(test?.questions.map((q) => q.type));
          expect(types.has('MULTIPLE_CHOICE')).toBe(true);
          expect(types.has('TRUE_FALSE')).toBe(true);
          expect(types.has('FILL_IN_THE_BLANK')).toBe(true);
        },
      );
    });

    it('binds tests to topics and classes', async () => {
      await policyCheck(
        'Tests',
        'Assignments → connect test, topic, and class section',
        async () => {
          const assignment = await prisma.assignment.findUnique({
            where: { id: seed.tests.classAssignment.id },
            include: { classSection: true, test: true },
          });
          expect(assignment?.testId).toBe(seed.tests.test.id);
          expect(assignment?.classSectionId).toBe(
            seed.academics.classSection.id,
          );
          expect(assignment?.topicLevelId).toBe(seed.content.topicLevel.id);
        },
      );
    });
  });

  describe('School structure', () => {
    it('tracks academic years per organization', async () => {
      await policyCheck(
        'Content',
        'AcademicYear → tied to organization context',
        async () => {
          const year = await prisma.academicYear.findUnique({
            where: { id: seed.academics.year.id },
          });
          expect(year?.orgId).toBe(seed.organizations.primary.id);
          expect(year?.isCurrent).toBe(true);
        },
      );
    });

    it('binds class sections to homeroom teachers', async () => {
      await policyCheck(
        'Content',
        'ClassSection → references teacher membership',
        async () => {
          const section = await prisma.classSection.findUnique({
            where: { id: seed.academics.classSection.id },
          });
          expect(section?.teacherId).toBe(seed.users.teacher.teacher.id);
        },
      );
    });

    it('enrolls students into sections for the academic year', async () => {
      await policyCheck(
        'Content',
        'Enrollment → aligns student with section/year',
        async () => {
          const enrollment = await prisma.enrollment.findUnique({
            where: { id: seed.academics.enrollment.id },
          });
          expect(enrollment?.classSectionId).toBe(
            seed.academics.classSection.id,
          );
          expect(enrollment?.yearId).toBe(seed.academics.year.id);
        },
      );
    });
  });

  describe('Submissions & auto-scoring', () => {
    let studentTokens: { accessToken: string; refreshToken: string };
    let submissionId: string | null = null;
    let secondAttemptStatus = 0;
    let thirdAttemptStatus = 0;

    beforeAll(async () => {
      studentTokens = await loginUser(server, seed.users.student);
      const createRes = await request(server)
        .post('/submissions')
        .set('Authorization', `Bearer ${studentTokens.accessToken}`)
        .send({ assignmentId: seed.tests.classAssignment.id });
      submissionId = createRes.body?.id ?? null;
      firstSubmissionId = submissionId;

      const responses = seed.tests.questions.map((question) => {
        let givenText: any = '';
        if (question.type === 'MULTIPLE_CHOICE') {
          givenText =
            question.correctAnswer ?? question.correctAnswers?.[0] ?? '';
        } else if (question.type === 'TRUE_FALSE') {
          givenText = question.correctAnswer ?? 'true';
        } else {
          givenText = question.correctAnswer ?? '';
        }
        return { questionId: question.id, givenText };
      });

      if (submissionId) {
        await request(server)
          .patch(`/submissions/${submissionId}/responses`)
          .set('Authorization', `Bearer ${studentTokens.accessToken}`)
          .send({ responses });

        await request(server)
          .post(`/submissions/${submissionId}/finish`)
          .set('Authorization', `Bearer ${studentTokens.accessToken}`)
          .send({ responses });
      }

      const secondRes = await request(server)
        .post('/submissions')
        .set('Authorization', `Bearer ${studentTokens.accessToken}`)
        .send({ assignmentId: seed.tests.classAssignment.id });
      secondAttemptStatus = secondRes.status;

      const thirdRes = await request(server)
        .post('/submissions')
        .set('Authorization', `Bearer ${studentTokens.accessToken}`)
        .send({ assignmentId: seed.tests.classAssignment.id });
      thirdAttemptStatus = thirdRes.status;
    });

    it('creates submission drafts per assignment', async () => {
      await policyCheck(
        'Submissions',
        'Submission → student can create draft',
        async () => {
          const submission = submissionId
            ? await prisma.submission.findUnique({
                where: { id: submissionId },
              })
            : null;
          expect(submission?.assignmentId).toBe(seed.tests.classAssignment.id);
          expect(submission?.attemptNo).toBe(1);
        },
      );
    });

    it('scores responses and sets submission metadata', async () => {
      await policyCheck(
        'Submissions',
        'Auto-scoring → normalizes score & flags correctness',
        async () => {
          if (!submissionId) throw new Error('Missing submission id');
          const submission = await prisma.submission.findUnique({
            where: { id: submissionId },
            include: { responses: true },
          });
          expect(submission?.status).toBe(SubmissionStatus.APPROVED);
          expect(submission?.score).toBe(1);
          expect(submission?.responses.every((r) => r.isCorrect)).toBe(true);
          expect(submission?.submittedAt).toBeTruthy();
        },
      );
    });

    it('allows a subsequent attempt when maxAttempts > 1', async () => {
      await policyCheck(
        'Submissions',
        'Attempts → second submission allowed',
        () => {
          expect(secondAttemptStatus).toBeLessThan(400);
        },
      );
    });

    it('blocks students after exceeding maxAttempts', async () => {
      await policyCheck(
        'Submissions',
        'Attempts → capped by assignment.maxAttempts',
        () => {
          expect(thirdAttemptStatus).toBeGreaterThanOrEqual(400);
        },
      );
    });
  });

  describe('Audit logging', () => {
    let teacherTokens: { accessToken: string; refreshToken: string };
    let auditTestId: string | null = null;

    beforeAll(async () => {
      teacherTokens = await loginUser(server, seed.users.teacher);
      const res = await request(server)
        .post('/tests')
        .set('Authorization', `Bearer ${teacherTokens.accessToken}`)
        .send({
          title: 'Audit policy test',
          description: 'Ensures AuditLog entries exist',
          organizationId: seed.organizations.primary.id,
        });
      auditTestId = res.body?.id ?? null;
    });

    it('captures registration audit entries', async () => {
      await policyCheck(
        'Audit',
        'AuditLog → REGISTER entry recorded',
        async () => {
          const logs = await prisma.auditLog.findMany({
            where: { userId: authFlow.userId ?? undefined, action: 'REGISTER' },
          });
          expect(logs.length).toBeGreaterThan(0);
        },
      );
    });

    it('captures login audit entries', async () => {
      await policyCheck(
        'Audit',
        'AuditLog → LOGIN action recorded',
        async () => {
          const logs = await prisma.auditLog.findMany({
            where: { userId: authFlow.userId ?? undefined, action: 'LOGIN' },
          });
          expect(logs.length).toBeGreaterThan(0);
        },
      );
    });

    it('captures test creation events', async () => {
      await policyCheck(
        'Audit',
        'AuditLog → TEST_CREATE entry recorded',
        async () => {
          const logs = await prisma.auditLog.findMany({
            where: {
              action: 'TEST_CREATE',
              entityId: auditTestId ?? undefined,
            },
          });
          expect(logs.length).toBeGreaterThan(0);
        },
      );
    });

    it('captures submission finish events', async () => {
      await policyCheck(
        'Audit',
        'AuditLog → SUBMISSION finish recorded',
        async () => {
          const logs = await prisma.auditLog.findMany({
            where: {
              action: 'SUBMISSION_FINISH',
              entityId: firstSubmissionId ?? undefined,
            },
          });
          expect(logs.length).toBeGreaterThan(0);
        },
      );
    });
  });

  describe('Plans & subscriptions', () => {
    it('keeps schools on SCHOOL-targeted plans', async () => {
      await policyCheck(
        'Plans',
        'Subscription → school linked to SCHOOL plan',
        async () => {
          const subscription = await prisma.subscription.findUnique({
            where: { id: seed.plans.subscription.id },
            include: { plan: true },
          });
          expect(subscription?.planId).toBe(seed.plans.schoolPlan.id);
          expect(subscription?.plan.target).toBe('SCHOOL');
        },
      );
    });

    it('rejects assigning PRIVATE plan to SCHOOL organization', async () => {
      await policyCheck(
        'Plans',
        'Subscription → PRIVATE plan blocked for schools',
        async () => {
          let createdId: string | null = null;
          try {
            const created = await prisma.subscription.create({
              data: {
                organizationId: seed.organizations.primary.id,
                planId: seed.plans.privatePlan.id,
                status: SubscriptionStatus.ACTIVE,
                startDate: new Date(),
                endDate: new Date(Date.now() + 86400000),
              },
            });
            createdId = created.id;
          } catch (error) {
            expect(error).toBeTruthy();
            return;
          } finally {
            if (createdId) {
              await prisma.subscription.delete({ where: { id: createdId } });
            }
          }

          expect(createdId).toBeNull();
        },
      );
    });
  });
});
