/**
 * E2E: API contract snapshot for GET /auth/me organization readiness payload.
 *
 * Ensures:
 * - organization.readinessState, canExecute, missing, evidence, currentYearId are present and correctly typed.
 * - No "active" fields at top-level of organization; deprecated aliases only under organization.deprecated (if any).
 *
 * See docs/ORG_READINESS_V2_INVARIANTS.md.
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole } from '@prisma/client';
import { OrganizationType } from '@prisma/client';
import { authAs } from 'test/helpers';
import { RegisterMode } from '@/auth/dto/register.dto';
import { OrgReadinessState } from '@/shared/org-readiness-v2';

function unwrap(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

const READINESS_STATES = Object.values(OrgReadinessState);

describe('GET /auth/me – organization readiness contract (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('organization has required readiness fields with correct types when user has org context', async () => {
    const auth = await authAs(app, OrganizationRole.OWNER, {
      seed: `readiness_contract_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });

    // authAs already provisioned this user's only organization
    // (a second org per user is 409 by contract)
    const orgId = auth.organization?.id as string;
    expect(orgId).toBeTruthy();

    const useOrgRes = await request(app.getHttpServer())
      .post('/auth/use-org')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ orgId })
      .expect(201);
    const token =
      (unwrap(useOrgRes) ?? useOrgRes.body)?.sessionToken ?? useOrgRes.body?.sessionToken;
    expect(token).toBeTruthy();

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = unwrap(meRes) ?? meRes.body;
    expect(data).toBeDefined();
    const org = data?.organization;
    expect(org).toBeDefined();
    expect(org.id).toBe(orgId);

    // Required readiness fields (contract snapshot)
    expect(org).toHaveProperty('readinessState');
    expect(READINESS_STATES).toContain(org.readinessState);
    expect(typeof org.readinessState).toBe('string');

    expect(org).toHaveProperty('canExecute');
    expect(typeof org.canExecute).toBe('boolean');

    expect(org).toHaveProperty('missing');
    expect(Array.isArray(org.missing)).toBe(true);
    org.missing.forEach((m: unknown) => expect(typeof m).toBe('string'));

    expect(org).toHaveProperty('evidence');
    expect(org.evidence).not.toBeNull();
    expect(typeof org.evidence).toBe('object');
    expect(org.evidence).toHaveProperty('hasCurrentYear');
    expect(typeof org.evidence.hasCurrentYear).toBe('boolean');
    expect(org.evidence).toHaveProperty('hasClassSectionInCurrentYear');
    expect(typeof org.evidence.hasClassSectionInCurrentYear).toBe('boolean');
    expect(org.evidence).toHaveProperty('hasAssignmentInCurrentYear');
    expect(typeof org.evidence.hasAssignmentInCurrentYear).toBe('boolean');

    expect(org).toHaveProperty('currentYearId');
    expect(
      org.currentYearId === null || typeof org.currentYearId === 'string',
    ).toBe(true);

    // No top-level "active" fields; deprecated aliases only under organization.deprecated
    expect(org).not.toHaveProperty('hasActiveAcademicYear');
    expect(org).not.toHaveProperty('activeYearId');
    expect(org).not.toHaveProperty('hasAnyClassSectionInActiveYear');
    if (org.deprecated != null) {
      expect(typeof org.deprecated).toBe('object');
      // If we add deprecated aliases, they must live here only
    }

    await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  });

  it('organization has no readiness fields when user has no org context', async () => {
    // A bare CREATE_ORG registration has no organization yet (onboarding
    // pending) — authAs would provision one, so register directly.
    const ts = Date.now();
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'No Org User',
        email: `no_org_${ts}@example.com`,
        username: `no_org_${ts}`,
        password: 'Password123!',
        mode: RegisterMode.CREATE_ORG,
      })
      .expect(201);
    const token = (unwrap(registerRes) ?? registerRes.body)?.sessionToken;
    expect(token).toBeTruthy();

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = unwrap(meRes) ?? meRes.body;
    expect(data?.organization).toBeNull();
  });
});
