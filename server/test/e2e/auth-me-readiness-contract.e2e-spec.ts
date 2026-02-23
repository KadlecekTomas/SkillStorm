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

    const createOrgRes = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ name: `Readiness Contract Org ${Date.now()}`, type: OrganizationType.SCHOOL })
      .expect(201);

    const orgId = unwrap(createOrgRes)?.id ?? createOrgRes.body?.id;
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
    const auth = await authAs(app, OrganizationRole.STUDENT, {
      seed: `no_org_${Date.now()}`,
      mode: RegisterMode.INDIVIDUAL,
    });

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    const data = unwrap(meRes) ?? meRes.body;
    expect(data?.organization).toBeNull();
  });
});
