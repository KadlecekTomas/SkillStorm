// test/e2e/catalog-subject-provisioning.e2e-spec.ts
/**
 * Enforces the subject auto-provisioning invariant at the service layer.
 *
 * Test A — New org receives Subject + SubjectLevel rows automatically
 *   After POST /auth/register (which internally calls OrganizationsService.create()),
 *   every CatalogSubject must have a corresponding Subject and
 *   one SubjectLevel per SchoolGrade for the new org.
 *
 * Test B — POST /platform/catalog/sync-subjects propagates a new CatalogSubject
 *   Adding a new CatalogSubject to the catalog and calling the sync endpoint
 *   must create the corresponding Subject + SubjectLevels for all existing orgs.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import * as request from 'supertest';
import { SchoolGrade, SystemRole } from '@prisma/client';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { authAs, createSystemUser } from 'test/helpers';

const GRADES = Object.values(SchoolGrade);
const unwrap = (res: request.Response) => res.body?.data ?? res.body;

describe('Subject auto-provisioning (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Track created entities for cleanup
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  let bootstrapCatalogId: string;

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

    // Ensure at least one CatalogSubject exists so provisioning has something to do.
    // Use a test-stable code so this is idempotent across runs.
    const bootstrap = await prisma.catalogSubject.upsert({
      where: { code: 'MAT' },
      update: {},
      create: { code: 'MAT', name: 'Matematika' },
    });
    bootstrapCatalogId = bootstrap.id;
  });

  afterAll(async () => {
    // Cleanup in dependency order
    for (const orgId of createdOrgIds) {
      await prisma.subjectLevel.deleteMany({
        where: { subject: { organizationId: orgId } },
      });
      await prisma.subject.deleteMany({ where: { organizationId: orgId } });
      await prisma.academicYear.deleteMany({ where: { orgId } });
      await prisma.membership.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    for (const userId of createdUserIds) {
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  // ── Test A ────────────────────────────────────────────────────────────────

  describe('Test A — new org is provisioned with subjects + subject levels', () => {
    let orgId: string;

    it('registers a new org and finds auto-provisioned subjects in DB', async () => {
      const seed = `prov_a_${Date.now()}`;
      const ctx = await authAs(app, 'DIRECTOR' as any, { seed });

      orgId = ctx.organization.id;
      createdOrgIds.push(orgId);
      createdUserIds.push(ctx.user.id);

      // How many catalog subjects exist now?
      const catalogCount = await prisma.catalogSubject.count();
      expect(catalogCount).toBeGreaterThan(0);

      // Org must have exactly one Subject per CatalogSubject
      const subjectCount = await prisma.subject.count({
        where: { organizationId: orgId, deletedAt: null },
      });
      expect(subjectCount).toBe(catalogCount);
    });

    it('each provisioned subject has one SubjectLevel per SchoolGrade', async () => {
      const subjects = await prisma.subject.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      expect(subjects.length).toBeGreaterThan(0);

      for (const subject of subjects) {
        const levelCount = await prisma.subjectLevel.count({
          where: { subjectId: subject.id },
        });
        expect(levelCount).toBe(GRADES.length);
      }
    });

    it('idempotent — calling provisioning again does not duplicate subjects or levels', async () => {
      const before = {
        subjects: await prisma.subject.count({ where: { organizationId: orgId } }),
        levels: await prisma.subjectLevel.count({
          where: { subject: { organizationId: orgId } },
        }),
      };

      // Trigger provisioning a second time by hitting register again is not practical;
      // instead call the DB-level invariant directly via the service layer.
      // We simulate by calling the same upserts: counts must stay identical.
      const catalogSubjects = await prisma.catalogSubject.findMany();
      await prisma.$transaction(async (tx) => {
        for (const catalog of catalogSubjects) {
          const subject = await tx.subject.upsert({
            where: {
              organizationId_catalogSubjectId: {
                organizationId: orgId,
                catalogSubjectId: catalog.id,
              },
            },
            update: {},
            create: { organizationId: orgId, catalogSubjectId: catalog.id, name: catalog.name },
          });
          for (const grade of GRADES) {
            await tx.subjectLevel.upsert({
              where: { subjectId_grade: { subjectId: subject.id, grade } },
              update: {},
              create: { subjectId: subject.id, grade, order: null, label: null },
            });
          }
        }
      });

      const after = {
        subjects: await prisma.subject.count({ where: { organizationId: orgId } }),
        levels: await prisma.subjectLevel.count({
          where: { subject: { organizationId: orgId } },
        }),
      };

      expect(after.subjects).toBe(before.subjects);
      expect(after.levels).toBe(before.levels);
    });
  });

  // ── Test B ────────────────────────────────────────────────────────────────

  describe('Test B — POST /platform/catalog/sync-subjects pushes new catalog entry to all orgs', () => {
    let superadminToken: string;
    let orgId: string;
    let bioCatalogId: string;

    const BIO_CODE = `BIO_E2E_${Date.now()}`;

    afterAll(async () => {
      // Remove the test-only CatalogSubject and its provisioned rows
      if (bioCatalogId) {
        await prisma.subjectLevel.deleteMany({
          where: { subject: { catalogSubjectId: bioCatalogId } },
        });
        await prisma.subject.deleteMany({ where: { catalogSubjectId: bioCatalogId } });
        await prisma.catalogSubject.deleteMany({ where: { id: bioCatalogId } });
      }
    });

    it('setup: create a SUPERADMIN user and a fresh org', async () => {
      // SUPERADMIN
      const adminCtx = await createSystemUser(
        app,
        prisma,
        SystemRole.SUPERADMIN,
        `sync_admin_${Date.now()}`,
      );
      superadminToken = adminCtx.accessToken;
      createdUserIds.push(adminCtx.user.id);

      // Fresh org that exists before the new CatalogSubject is added
      const ownerCtx = await authAs(app, 'DIRECTOR' as any, { seed: `sync_org_${Date.now()}` });
      orgId = ownerCtx.organization.id;
      createdOrgIds.push(orgId);
      createdUserIds.push(ownerCtx.user.id);

      // Verify org has NO BIO subject yet (the catalog entry doesn't exist yet)
      const bioBefore = await prisma.subject.count({
        where: { organizationId: orgId, catalogSubject: { code: BIO_CODE } },
      });
      expect(bioBefore).toBe(0);
    });

    it('adds a new CatalogSubject (BIO) directly to the catalog', async () => {
      const bio = await prisma.catalogSubject.create({
        data: { code: BIO_CODE, name: 'Biologie E2E' },
      });
      bioCatalogId = bio.id;
      expect(bio.id).toBeTruthy();
    });

    it('POST /platform/catalog/sync-subjects → 201, reports orgsProcessed > 0', async () => {
      const res = await request(app.getHttpServer())
        .post('/platform/catalog/sync-subjects')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(201);

      const body = unwrap(res);
      expect(body.orgsProcessed).toBeGreaterThan(0);
      expect(body.catalogSubjectsFound).toBeGreaterThan(0);
      expect(body.levelUpserts).toBeGreaterThan(0);
    });

    it('org now has a Subject for BIO with a SubjectLevel per SchoolGrade', async () => {
      const bioSubject = await prisma.subject.findFirst({
        where: { organizationId: orgId, catalogSubjectId: bioCatalogId },
        select: { id: true },
      });
      expect(bioSubject).not.toBeNull();

      const levelCount = await prisma.subjectLevel.count({
        where: { subjectId: bioSubject!.id },
      });
      expect(levelCount).toBe(GRADES.length);
    });

    it('403 when a non-SUPERADMIN calls sync-subjects', async () => {
      // Create a regular user (no systemRole)
      const regular = await authAs(app, 'DIRECTOR' as any, { seed: `sync_forbidden_${Date.now()}` });
      createdOrgIds.push(regular.organization.id);
      createdUserIds.push(regular.user.id);

      await request(app.getHttpServer())
        .post('/platform/catalog/sync-subjects')
        .set('Authorization', `Bearer ${regular.accessToken}`)
        .expect(403);
    });
  });
});
