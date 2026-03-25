/**
 * Full system walkthrough seed – produkčně realistická data pro celý web.
 * Spuštění: npm run seed:full (nebo ts-node prisma/seed/full-walkthrough-seed.ts)
 *
 * Idempotentní: používá findFirst + create nebo upsert podle kontextu.
 * Žádné změny schématu, pouze existující Prisma modely.
 *
 * Scénáře pokryté seedem:
 * - Student A: 1 pokus, ~45 % (jeden test odevzdaný)
 * - Student B: 2 pokusy, 40 % → 75 % (MiniProgressBlock ukáže + rozdíl)
 * - Student C: 3 pokusy, 30 % → 50 % → 65 % (postupný růst, timeline více položek)
 * - Student D: žádné odevzdání (prázdná timeline, empty state)
 * - Student E: 2 pokusy, 80 % → 60 % (MiniProgressBlock ukáže − rozdíl)
 * - Student F: pouze 1 test odevzdaný, ostatní ne (částečná aktivita)
 * - Třída 8.C: bez přiřazených testů (negativní scénář – třída bez testů)
 * - GET /analytics/student-timeline: více položek pro jedno assignmentId, správné pořadí
 */
import 'dotenv/config';
import {
  EnrollmentStatus,
  OrganizationRole,
  OrganizationStatus,
  OrganizationType,
  PublishStatus,
  PrismaClient,
  QuestionType,
  SchoolGrade,
  SubmissionStatus,
  SystemRole,
  TopicPhase,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  computeScore,
  type QuestionForScoring,
} from '../../src/submissions/submission-scoring';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Password123!';

// --- Konstanty pro identifikaci seed dat (idempotence) ---
const ORG_NAMES = {
  ZS: 'Základní škola Demo',
  GYM: 'Gymnázium Demo',
  KOMUNITA: 'Komunitní vzdělávací centrum',
} as const;

const YEAR_LABEL = '2025/2026';
const STARTS_AT = new Date('2025-09-01T00:00:00.000Z');
const ENDS_AT = new Date('2026-08-31T23:59:59.999Z');

/** Returns a random Date within [startsAt, endsAt], clamped to endsAt. */
function randomDateWithinYear(
  startsAt: Date,
  endsAt: Date,
  offsetMs = 0,
): Date {
  const range = endsAt.getTime() - startsAt.getTime();
  const random = Math.floor(Math.random() * range);
  const result = new Date(startsAt.getTime() + random + offsetMs);
  return result > endsAt ? endsAt : result;
}

function logStep(msg: string) {
  console.log(`🌱 ${msg}`);
}

function logDone(msg: string) {
  console.log(`✅ ${msg}`);
}

async function hash(plain: string) {
  return bcrypt.hash(plain, 10);
}

// --- 0) PLATFORM BOOTSTRAP USERS (systemRole only, no memberships) ---
async function ensurePlatformBootstrapUsers() {
  console.log('🌍 Platform bootstrap');
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv !== 'development') {
    console.warn('⚠️ Running platform bootstrap outside development');
  }

  const passwordHash = await hash(DEMO_PASSWORD);
  const platformUsers: Array<{
    email: string;
    name: string;
    role: SystemRole;
    readyLabel: string;
  }> = [
    {
      email: 'superadmin@platform.local',
      name: 'Platform Superadmin',
      role: SystemRole.SUPERADMIN,
      readyLabel: 'SUPERADMIN',
    },
    {
      email: 'devops@platform.local',
      name: 'Platform DevOps',
      role: SystemRole.DEVOPS,
      readyLabel: 'DEVOPS',
    },
    {
      email: 'support@platform.local',
      name: 'Platform Support',
      role: SystemRole.SUPPORT,
      readyLabel: 'SUPPORT',
    },
  ];

  for (const entry of platformUsers) {
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      create: {
        email: entry.email,
        name: entry.name,
        passwordHash,
        systemRole: entry.role,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      update: {
        name: entry.name,
        systemRole: entry.role,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
    });

    const hasDemoPassword = await bcrypt.compare(
      DEMO_PASSWORD,
      user.passwordHash,
    );
    if (!hasDemoPassword) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
    }

    // Platform users must never be tenant-bound.
    await prisma.membership.deleteMany({ where: { userId: user.id } });

    console.log(`✅ ${entry.readyLabel} ready`);
  }
}

function printDemoBanner(
  users: Array<{ email: string; org: string; role: string }>,
  password: string,
) {
  const env = process.env.NODE_ENV ?? 'development';
  console.log('\n--- DEMO SEED BANNER (copy-paste) ---');
  console.log('NODE_ENV=' + env);
  console.log('Shared password (all demo users): ' + password);
  console.log('Demo users (email | org | role):');
  for (const u of users) {
    console.log(`  ${u.email} | ${u.org} | ${u.role}`);
  }
  console.log('--- END DEMO BANNER ---\n');
}

// --- 1) ORGANIZACE (multi-tenant) ---
async function createOrganizations() {
  logStep('Organizations: creating 3 tenants');
  const orgs: { id: string; name: string; type: OrganizationType }[] = [];

  const configs: Array<{ name: string; type: OrganizationType }> = [
    { name: ORG_NAMES.ZS, type: OrganizationType.SCHOOL },
    { name: ORG_NAMES.GYM, type: OrganizationType.SCHOOL },
    { name: ORG_NAMES.KOMUNITA, type: OrganizationType.COMMUNITY },
  ];

  for (const { name, type } of configs) {
    const existing = await prisma.organization.findFirst({
      where: { name, deletedAt: null },
    });
    if (existing) {
      await prisma.organization.update({
        where: { id: existing.id },
        data: { status: OrganizationStatus.ACTIVE, type },
      });
      orgs.push({ id: existing.id, name, type });
    } else {
      const org = await prisma.organization.create({
        data: {
          name,
          type,
          status: OrganizationStatus.ACTIVE,
        },
      });
      orgs.push({ id: org.id, name, type });
    }
  }
  logDone(`Organizations: ${orgs.length}`);
  return orgs;
}

// --- 2) ŠKOLNÍ ROKY (1 aktivní na org) ---
async function createAcademicYears(orgs: { id: string }[]) {
  logStep('Academic years: 1 active per org (2024/2025)');
  const years: { id: string; orgId: string }[] = [];

  for (const org of orgs) {
    await prisma.academicYear.updateMany({
      where: { orgId: org.id, isCurrent: true },
      data: { isCurrent: false },
    });
    const existing = await prisma.academicYear.findFirst({
      where: { orgId: org.id, label: YEAR_LABEL },
    });
    if (existing) {
      await prisma.academicYear.update({
        where: { id: existing.id },
        data: { startsAt: STARTS_AT, endsAt: ENDS_AT, isCurrent: true },
      });
      years.push({ id: existing.id, orgId: org.id });
    } else {
      const y = await prisma.academicYear.create({
        data: {
          orgId: org.id,
          label: YEAR_LABEL,
          startsAt: STARTS_AT,
          endsAt: ENDS_AT,
          isCurrent: true,
        },
      });
      years.push({ id: y.id, orgId: org.id });
    }
  }
  logDone(`Academic years: ${years.length}`);
  return years;
}

// --- 3) TŘÍDY (min. 2 na org) ---
async function createClassSections(
  orgs: { id: string }[],
  years: { id: string; orgId: string }[],
) {
  logStep('Class sections: at least 2 per org');
  const sections: {
    id: string;
    orgId: string;
    yearId: string;
    grade: SchoolGrade;
    label: string;
  }[] = [];
  const gradeSectionPairs: [SchoolGrade, string, string][] = [
    [SchoolGrade.GRADE_6, 'A', '6.A'],
    [SchoolGrade.GRADE_7, 'B', '7.B'],
    [SchoolGrade.GRADE_8, 'C', '8.C'],
  ];

  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i];
    if (!org) continue;
    const year = years.find((y) => y.orgId === org.id);
    if (!year) continue;
    for (let j = 0; j < 3; j++) {
      const pair = gradeSectionPairs[j];
      if (!pair) continue;
      const [grade, section, label] = pair;
      const existing = await prisma.classSection.findFirst({
        where: {
          orgId: org.id,
          yearId: year.id,
          grade,
          section,
        },
      });
      if (existing) {
        await prisma.classSection.update({
          where: { id: existing.id },
          data: { label },
        });
        sections.push({
          id: existing.id,
          orgId: org.id,
          yearId: year.id,
          grade,
          label,
        });
      } else {
        const cs = await prisma.classSection.create({
          data: {
            orgId: org.id,
            yearId: year.id,
            grade,
            section,
            label,
          },
        });
        sections.push({
          id: cs.id,
          orgId: org.id,
          yearId: year.id,
          grade,
          label,
        });
      }
    }
  }
  logDone(`Class sections: ${sections.length}`);
  return sections;
}

// --- 4) UŽIVATELÉ + ROLE (director, 2 učitelé, 6 studentů na org) ---
type OrgUserIds = {
  orgId: string;
  directorMembershipId: string;
  teacherMembershipIds: string[];
  studentMembershipIds: string[];
  creatorMembershipId: string;
};

async function createUsersAndMembers(
  orgs: { id: string; name: string }[],
): Promise<OrgUserIds[]> {
  logStep('Users + memberships: director, 2 teachers, 6 students per org');
  const passwordHash = await hash(DEMO_PASSWORD);
  const result: OrgUserIds[] = [];

  for (let o = 0; o < orgs.length; o++) {
    const org = orgs[o];
    if (!org) continue;
    const suffix = o === 0 ? 'zs' : o === 1 ? 'gym' : 'kom';
    const emails = {
      director: `director@${suffix}.demo.local`,
      teacher1: `teacher1@${suffix}.demo.local`,
      teacher2: `teacher2@${suffix}.demo.local`,
      studentA: `student-a@${suffix}.demo.local`,
      studentB: `student-b@${suffix}.demo.local`,
      studentC: `student-c@${suffix}.demo.local`,
      studentD: `student-d@${suffix}.demo.local`,
      studentE: `student-e@${suffix}.demo.local`,
      studentF: `student-f@${suffix}.demo.local`,
    };

    const userIds: Record<string, string> = {};
    for (const [key, email] of Object.entries(emails)) {
      const existing = await prisma.user.findUnique({ where: { email } });
      const name =
        key === 'director'
          ? `Ředitel ${org.name}`
          : key.startsWith('teacher')
            ? `Učitel ${key.slice(-1)} ${org.name}`
            : `Žák ${key.replace('student', '')} ${org.name}`;
      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { name },
        });
        userIds[key] = existing.id;
      } else {
        const u = await prisma.user.create({
          data: { email, name, passwordHash },
        });
        userIds[key] = u.id;
      }
    }

    const membershipIds: Record<string, string> = {};
    const roles: Array<{ key: string; role: OrganizationRole }> = [
      { key: 'director', role: OrganizationRole.DIRECTOR },
      { key: 'teacher1', role: OrganizationRole.TEACHER },
      { key: 'teacher2', role: OrganizationRole.TEACHER },
      { key: 'studentA', role: OrganizationRole.STUDENT },
      { key: 'studentB', role: OrganizationRole.STUDENT },
      { key: 'studentC', role: OrganizationRole.STUDENT },
      { key: 'studentD', role: OrganizationRole.STUDENT },
      { key: 'studentE', role: OrganizationRole.STUDENT },
      { key: 'studentF', role: OrganizationRole.STUDENT },
    ];

    for (const { key, role } of roles) {
      const userId = userIds[key];
      if (!userId) throw new Error(`Seed: missing userId for ${key}`);
      const existing = await prisma.membership.findUnique({
        where: {
          userId_organizationId: { userId, organizationId: org.id },
        },
      });
      if (existing) {
        await prisma.membership.update({
          where: { id: existing.id },
          data: { role, deletedAt: null },
        });
        membershipIds[key] = existing.id;
      } else {
        const m = await prisma.membership.create({
          data: { userId, organizationId: org.id, role },
        });
        membershipIds[key] = m.id;
      }
    }

    const dirId = membershipIds.director!;
    const t1Id = membershipIds.teacher1!;
    const t2Id = membershipIds.teacher2!;
    result.push({
      orgId: org.id,
      directorMembershipId: dirId,
      teacherMembershipIds: [t1Id, t2Id],
      studentMembershipIds: [
        membershipIds.studentA!,
        membershipIds.studentB!,
        membershipIds.studentC!,
        membershipIds.studentD!,
        membershipIds.studentE!,
        membershipIds.studentF!,
      ],
      creatorMembershipId: t1Id,
    });
  }
  logDone(`Users/members: ${result.length} orgs`);
  return result;
}

// --- Učitelé (Teacher record) ---
async function createTeachers(orgUsers: OrgUserIds[]) {
  logStep('Teachers: Teacher record per teacher membership');
  for (const org of orgUsers) {
    for (const membershipId of org.teacherMembershipIds) {
      if (!membershipId) continue;
      const existing = await prisma.teacher.findUnique({
        where: { membershipId },
      });
      if (!existing) {
        await prisma.teacher.create({
          data: { membershipId, organizationId: org.orgId },
        });
      }
    }
  }
  logDone('Teachers ready');
}

// --- Homeroom: přiřadit učitele k 6.A a 7.B (pro teacher workflow / analytics) ---
async function setHomeroomTeachers(
  orgUsers: OrgUserIds[],
  sections: { id: string; orgId: string; label: string }[],
) {
  logStep('Homeroom: assigning teacher to 6.A and 7.B');
  for (const org of orgUsers) {
    const firstTeacherMembershipId = org.teacherMembershipIds[0];
    if (!firstTeacherMembershipId) continue;
    const teacher = await prisma.teacher.findFirst({
      where: {
        membershipId: firstTeacherMembershipId,
        organizationId: org.orgId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!teacher) continue;
    const orgSections = sections.filter(
      (s) => s.orgId === org.orgId && (s.label === '6.A' || s.label === '7.B'),
    );
    for (const sec of orgSections) {
      await prisma.classSection.update({
        where: { id: sec.id },
        data: { teacherId: teacher.id },
      });
    }
  }
  logDone('Homeroom set');
}

// --- TeacherClassSection: teacher2 explicitly teaches 8.C (not homeroom) ---
// Demonstrates the “teaches” model: teacher2 is homeroom of none, but can see 8.C results.
async function createTeacherClassSections(
  orgUsers: OrgUserIds[],
  sections: { id: string; orgId: string; yearId: string; label: string }[],
) {
  logStep('TeacherClassSection: teacher2 explicitly assigned to 8.C');
  for (const org of orgUsers) {
    const secondTeacherMembershipId = org.teacherMembershipIds[1];
    if (!secondTeacherMembershipId) continue;
    const teacher = await prisma.teacher.findFirst({
      where: { membershipId: secondTeacherMembershipId, organizationId: org.orgId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) continue;
    const class8C = sections.find((s) => s.orgId === org.orgId && s.label === '8.C');
    if (!class8C) continue;
    await prisma.teacherClassSection.upsert({
      where: { teacherId_classSectionId: { teacherId: teacher.id, classSectionId: class8C.id } },
      update: { deletedAt: null },
      create: { teacherId: teacher.id, classSectionId: class8C.id, yearId: class8C.yearId },
    });
  }
  logDone('TeacherClassSection set');
}

// --- Studenti + Enrollment (A,B,C v 6.A; D,E,F v 7.B; 8.C prázdná pro „třída bez testů”) ---
async function createStudentsAndEnrollments(
  orgUsers: OrgUserIds[],
  sections: { id: string; orgId: string; yearId: string; label: string }[],
) {
  logStep('Students + enrollments: 6 students per org, distributed in classes');
  for (const org of orgUsers) {
    const orgSections = sections
      .filter((s) => s.orgId === org.orgId)
      .sort((a, b) => a.label.localeCompare(b.label));
    const class6A = orgSections.find((s) => s.label === '6.A');
    const class7B = orgSections.find((s) => s.label === '7.B');
    const class8C = orgSections.find((s) => s.label === '8.C');
    if (!class6A || !class7B) continue;

    const studentKeys = [
      'studentA',
      'studentB',
      'studentC',
      'studentD',
      'studentE',
      'studentF',
    ];
    const classByKey: Record<string, typeof class6A> = {
      studentA: class6A,
      studentB: class6A,
      studentC: class6A,
      studentD: class7B,
      studentE: class7B,
      studentF: class7B,
    };

    for (const key of studentKeys) {
      const membershipId = org.studentMembershipIds[studentKeys.indexOf(key)];
      const classSection = classByKey[key];
      if (!classSection || !membershipId) continue;

      let student = await prisma.student.findUnique({
        where: { membershipId },
      });
      const existingEnrollment = student
        ? await prisma.enrollment.findFirst({
            where: { studentId: student.id, yearId: classSection.yearId },
          })
        : null;

      if (existingEnrollment) {
        await prisma.enrollment.update({
          where: { id: existingEnrollment.id },
          data: {
            classSectionId: classSection.id,
            orgId: org.orgId,
            status: EnrollmentStatus.ACTIVE,
          },
        });
      } else if (!student) {
        await prisma.$transaction(async (tx) => {
          student = await tx.student.create({
            data: { membershipId, orgId: org.orgId },
          });
          await tx.enrollment.create({
            data: {
              studentId: student!.id,
              classSectionId: classSection.id,
              yearId: classSection.yearId,
              orgId: org.orgId,
              status: EnrollmentStatus.ACTIVE,
            },
          });
        });
        student = await prisma.student.findUnique({
          where: { membershipId },
        });
      } else {
        await prisma.enrollment.create({
          data: {
            studentId: student.id,
            classSectionId: classSection.id,
            yearId: classSection.yearId,
            orgId: org.orgId,
            status: EnrollmentStatus.ACTIVE,
          },
        });
      }
    }
  }
  logDone('Students + enrollments ready');
}

// --- 4b) CATALOG SUBJECTS + ORG SUBJECTS (Subject model) ---
/**
 * Upserts all CatalogSubjects, then provisions one Subject per catalog entry per org
 * (mirrors OrganizationsService.provisionDefaultSubjects — idempotent upsert).
 * Returns a nested map: orgId → catalogCode → subjectId
 */
async function ensureCatalogAndSubjects(
  orgs: OrgWithName[],
): Promise<Map<string, Map<string, string>>> {
  logStep('CatalogSubjects + org Subjects');

  // Upsert all catalog entries
  const catalogMap = new Map<string, string>(); // code → id
  for (const def of WALKTHROUGH_SUBJECT_DEFS) {
    const cat = await prisma.catalogSubject.upsert({
      where: { code: def.code },
      update: { name: def.name },
      create: { code: def.code, name: def.name },
    });
    catalogMap.set(def.code, cat.id);

    for (const topicName of def.topics) {
      await prisma.catalogTopic.upsert({
        where: {
          subjectId_name: {
            subjectId: cat.id,
            name: topicName,
          },
        },
        update: {},
        create: {
          subjectId: cat.id,
          name: topicName,
        },
      });
    }
  }

  const grades = Object.values(SchoolGrade);

  // Provision all catalog subjects for every org (all codes, not a subset)
  const result = new Map<string, Map<string, string>>();

  for (const org of orgs) {
    const orgMap = new Map<string, string>();

    for (const def of WALKTHROUGH_SUBJECT_DEFS) {
      const catalogId = catalogMap.get(def.code)!;

      const subject = await prisma.subject.upsert({
        where: { catalogSubjectId: catalogId },
        update: { name: def.name, gradeFrom: def.gradeFrom, gradeTo: def.gradeTo },
        create: {
          catalogSubjectId: catalogId,
          name: def.name,
          gradeFrom: def.gradeFrom,
          gradeTo: def.gradeTo,
        },
      });

      for (const grade of grades) {
        const subjectLevel = await prisma.subjectLevel.upsert({
          where: {
            subjectId_grade: {
              subjectId: subject.id,
              grade,
            },
          },
          update: {},
          create: {
            subjectId: subject.id,
            grade,
            order: null,
            label: null,
          },
        });

        const catalogTopics = await prisma.catalogTopic.findMany({
          where: { subjectId: catalogId },
          select: { id: true, name: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        });

        for (let index = 0; index < catalogTopics.length; index += 1) {
          const topic = catalogTopics[index];
          if (!topic) continue;
          await prisma.topicLevel.upsert({
            where: {
              subjectLevelId_catalogTopicId_phase: {
                subjectLevelId: subjectLevel.id,
                catalogTopicId: topic.id,
                phase: TopicPhase.INTRO,
              },
            },
            update: {
              name: topic.name,
              order: index + 1,
            },
            create: {
              subjectLevelId: subjectLevel.id,
              catalogTopicId: topic.id,
              name: topic.name,
              order: index + 1,
              phase: TopicPhase.INTRO,
            },
          });
        }
      }

      orgMap.set(def.code, subject.id);
    }
    result.set(org.id, orgMap);
  }

  logDone(`Catalog subjects + org subjects ready`);
  return result;
}

function schoolGradeToNumber(grade: SchoolGrade): number {
  switch (grade) {
    case SchoolGrade.GRADE_1:
      return 1;
    case SchoolGrade.GRADE_2:
      return 2;
    case SchoolGrade.GRADE_3:
      return 3;
    case SchoolGrade.GRADE_4:
      return 4;
    case SchoolGrade.GRADE_5:
      return 5;
    case SchoolGrade.GRADE_6:
      return 6;
    case SchoolGrade.GRADE_7:
      return 7;
    case SchoolGrade.GRADE_8:
      return 8;
    case SchoolGrade.GRADE_9:
      return 9;
    case SchoolGrade.HIGH_SCHOOL_YEAR_1:
      return 10;
    case SchoolGrade.HIGH_SCHOOL_YEAR_2:
      return 11;
    case SchoolGrade.HIGH_SCHOOL_YEAR_3:
      return 12;
    case SchoolGrade.HIGH_SCHOOL_YEAR_4:
      return 13;
  }
}

async function attachOrgSubjectsToSeededClassSections(
  orgs: OrgWithName[],
  sections: { id: string; orgId: string; grade: SchoolGrade }[],
  subjectsByOrg: Map<string, Map<string, string>>,
) {
  logStep('Class section subjects: attaching grade-compatible org subjects');

  let createdOrgSubjects = 0;
  let createdLinks = 0;

  for (const org of orgs) {
    const subjectIds = Array.from(subjectsByOrg.get(org.id)?.values() ?? []);
    if (subjectIds.length === 0) continue;

    const subjects = await prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, gradeFrom: true, gradeTo: true },
    });

    const orgSubjectIdsBySubjectId = new Map<string, string>();

    for (const subject of subjects) {
      const orgSubject = await prisma.orgSubject.upsert({
        where: {
          organizationId_subjectId: {
            organizationId: org.id,
            subjectId: subject.id,
          },
        },
        update: {
          isEnabled: true,
        },
        create: {
          organizationId: org.id,
          subjectId: subject.id,
          isEnabled: true,
        },
      });

      orgSubjectIdsBySubjectId.set(subject.id, orgSubject.id);
    }

    createdOrgSubjects += orgSubjectIdsBySubjectId.size;

    const orgSections = sections.filter((section) => section.orgId === org.id);

    for (const section of orgSections) {
      const grade = schoolGradeToNumber(section.grade);

      for (const subject of subjects) {
        const matchesGrade =
          grade >= subject.gradeFrom && grade <= subject.gradeTo;
        if (!matchesGrade) continue;

        const orgSubjectId = orgSubjectIdsBySubjectId.get(subject.id);
        if (!orgSubjectId) continue;

        await prisma.classSectionOrgSubject.upsert({
          where: {
            classSectionId_orgSubjectId: {
              classSectionId: section.id,
              orgSubjectId,
            },
          },
          update: {},
          create: {
            classSectionId: section.id,
            orgSubjectId,
          },
        });

        createdLinks += 1;
      }
    }
  }

  logDone(
    `Class section subjects ready (${createdOrgSubjects} org subjects, ${createdLinks} class links)`,
  );
}

// Title → catalog code mapping
const TITLE_TO_CODE: Record<string, string> = {
  'Matematika – zlomky': 'MAT',
  'Český jazyk – pravopis': 'CZJ',
  'Fyzika – síly': 'FYZ',
  'Matematika – funkce': 'MAT',
  'Český jazyk – literatura': 'CZJ',
  'Dějepis – 20. století': 'DEJ',
  'Základy programování': 'INF',
  'Angličtina – B1': 'ENG',
  'Finanční gramotnost': 'ECO',
};

const TEST_TOPIC_MAP: Record<string, string> = {
  'Matematika – Zlomky': 'Zlomky',
  'Matematika – zlomky': 'Zlomky',
  'Matematika – Rovnice': 'Rovnice',
  'Matematika – funkce': 'Rovnice',
  'Matematika – Procenta': 'Procenta',
  'Český jazyk – pravopis': 'Pravopis',
  'Český jazyk – literatura': 'Literatura',
  'Angličtina – B1': 'Vocabulary',
  'Základy programování': 'Programování',
  'Fyzika – síly': 'Mechanika',
  'Dějepis – 20. století': 'Novověk',
  'Finanční gramotnost': 'Rozpočet',
};

type ResolvedTopic = {
  id: string;
  name: string;
};

function normalizeSeedText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

async function findTopicForSubjectByName(
  subjectId: string,
  topicName: string,
): Promise<ResolvedTopic | null> {
  const normalizedTarget = normalizeSeedText(topicName);
  const candidates = await prisma.topicLevel.findMany({
    where: {
      subjectLevel: { subjectId },
    },
    select: {
      id: true,
      name: true,
      catalogTopic: { select: { name: true } },
    },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });

  for (const candidate of candidates) {
    const candidateName = candidate.name?.trim() || candidate.catalogTopic?.name?.trim() || '';
    if (candidateName && normalizeSeedText(candidateName) === normalizedTarget) {
      return { id: candidate.id, name: candidateName };
    }
  }
  return null;
}

async function resolveTopicForTest(
  testTitle: string,
  subjectId: string,
): Promise<ResolvedTopic | null> {
  const explicitTopic = TEST_TOPIC_MAP[testTitle];
  if (explicitTopic) {
    const mapped = await findTopicForSubjectByName(subjectId, explicitTopic);
    if (mapped) return mapped;
  }

  const lower = normalizeSeedText(testTitle);
  if (lower.includes('zlomk')) {
    const fractions = await findTopicForSubjectByName(subjectId, 'Zlomky');
    if (fractions) return fractions;
  }
  if (lower.includes('rovnic') || lower.includes('funkc')) {
    const equations = await findTopicForSubjectByName(subjectId, 'Rovnice');
    if (equations) return equations;
  }
  if (lower.includes('procent')) {
    const percentages = await findTopicForSubjectByName(subjectId, 'Procenta');
    if (percentages) return percentages;
  }
  if (lower.includes('pravopis')) {
    const spelling = await findTopicForSubjectByName(subjectId, 'Pravopis');
    if (spelling) return spelling;
  }
  if (lower.includes('gramatik')) {
    const grammar = await findTopicForSubjectByName(subjectId, 'Gramatika');
    if (grammar) return grammar;
  }
  if (lower.includes('literatur')) {
    const literature = await findTopicForSubjectByName(subjectId, 'Literatura');
    if (literature) return literature;
  }
  if (lower.includes('vocab') || lower.includes('anglict') || lower.includes('english') || lower.includes('b1')) {
    const vocabulary = await findTopicForSubjectByName(subjectId, 'Vocabulary');
    if (vocabulary) return vocabulary;
  }
  if (lower.includes('algorithm')) {
    const algorithms = await findTopicForSubjectByName(subjectId, 'Algoritmy');
    if (algorithms) return algorithms;
  }
  if (lower.includes('program')) {
    const programming = await findTopicForSubjectByName(subjectId, 'Programování');
    if (programming) return programming;
  }
  if (lower.includes('mechanik') || lower.includes('sil')) {
    const mechanics = await findTopicForSubjectByName(subjectId, 'Mechanika');
    if (mechanics) return mechanics;
  }
  if (lower.includes('elektr')) {
    const electricity = await findTopicForSubjectByName(subjectId, 'Elektřina');
    if (electricity) return electricity;
  }
  if (lower.includes('starovek')) {
    const antiquity = await findTopicForSubjectByName(subjectId, 'Starověk');
    if (antiquity) return antiquity;
  }
  if (lower.includes('novovek') || lower.includes('20. stoleti')) {
    const modernHistory = await findTopicForSubjectByName(subjectId, 'Novověk');
    if (modernHistory) return modernHistory;
  }
  if (lower.includes('rozpo')) {
    const budget = await findTopicForSubjectByName(subjectId, 'Rozpočet');
    if (budget) return budget;
  }
  if (lower.includes('usp')) {
    const savings = await findTopicForSubjectByName(subjectId, 'Úspory');
    if (savings) return savings;
  }

  const fallback = await prisma.topicLevel.findFirst({
    where: {
      subjectLevel: { subjectId },
    },
    select: {
      id: true,
      name: true,
      catalogTopic: { select: { name: true } },
    },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });

  if (!fallback) return null;
  return {
    id: fallback.id,
    name: fallback.name?.trim() || fallback.catalogTopic?.name?.trim() || 'Neznámé téma',
  };
}

// --- 5) TESTY (min. 3 na org, PUBLISHED, scoreable) ---
type OrgWithName = { id: string; name: string };
type CatalogSubjectSeedDef = {
  code: string;
  name: string;
  gradeFrom: number;
  gradeTo: number;
  topics: string[];
};

const WALKTHROUGH_SUBJECT_DEFS: CatalogSubjectSeedDef[] = [
  { code: 'MAT', name: 'Matematika', gradeFrom: 1, gradeTo: 9, topics: ['Zlomky', 'Rovnice', 'Procenta'] },
  { code: 'CZJ', name: 'Český jazyk', gradeFrom: 1, gradeTo: 9, topics: ['Pravopis', 'Gramatika', 'Literatura'] },
  { code: 'ENG', name: 'Angličtina', gradeFrom: 1, gradeTo: 9, topics: ['Vocabulary', 'Grammar'] },
  { code: 'INF', name: 'Informatika', gradeFrom: 1, gradeTo: 9, topics: ['Algoritmy', 'Programování'] },
  { code: 'FYZ', name: 'Fyzika', gradeFrom: 6, gradeTo: 9, topics: ['Mechanika', 'Elektřina'] },
  { code: 'DEJ', name: 'Dějepis', gradeFrom: 6, gradeTo: 9, topics: ['Starověk', 'Novověk'] },
  { code: 'ECO', name: 'Finanční gramotnost', gradeFrom: 1, gradeTo: 9, topics: ['Rozpočet', 'Úspory'] },
];

async function createTests(
  orgs: OrgWithName[],
  orgUsers: OrgUserIds[],
  years: { id: string; orgId: string }[],
  subjectsByOrg: Map<string, Map<string, string>>,
) {
  logStep('Tests: min 3 per org, realistic titles, scoreable');
  const testTitlesByOrg: Record<string, string[]> = {
    [ORG_NAMES.ZS]: [
      'Matematika – zlomky',
      'Český jazyk – pravopis',
      'Fyzika – síly',
    ],
    [ORG_NAMES.GYM]: [
      'Matematika – funkce',
      'Český jazyk – literatura',
      'Dějepis – 20. století',
    ],
    [ORG_NAMES.KOMUNITA]: [
      'Základy programování',
      'Angličtina – B1',
      'Finanční gramotnost',
    ],
  };

  const allTests: {
    id: string;
    orgId: string;
    testId: string;
    title: string;
    subjectId: string | null;
    questionIds: string[];
    questions: QuestionForScoring[];
  }[] = [];

  for (const org of orgs) {
    const titles = testTitlesByOrg[org.name] ?? testTitlesByOrg[ORG_NAMES.ZS];
    if (!titles) continue;
    const creatorId = orgUsers.find(
      (u) => u.orgId === org.id,
    )?.creatorMembershipId;
    if (!creatorId) continue;

    const orgYearId = years.find((y) => y.orgId === org.id)?.id ?? null;
    const orgSubjects = subjectsByOrg.get(org.id) ?? new Map<string, string>();

    for (const title of titles) {
      const code = TITLE_TO_CODE[title];
      const subjectId = code ? (orgSubjects.get(code) ?? null) : null;

      let test = await prisma.test.findFirst({
        where: { organizationId: org.id, title, deletedAt: null },
      });
      if (!test) {
        test = await prisma.test.create({
          data: {
            organizationId: org.id,
            title,
            description: `Test: ${title}`,
            allowedGrades: [SchoolGrade.GRADE_6, SchoolGrade.GRADE_7, SchoolGrade.GRADE_8],
            status: PublishStatus.PUBLISHED,
            creatorId,
            ...(subjectId && { subjectId }),
            ...(orgYearId && { academicYearId: orgYearId }),
          },
        });
      } else {
        await prisma.test.update({
          where: { id: test.id },
          data: {
            allowedGrades: [SchoolGrade.GRADE_6, SchoolGrade.GRADE_7, SchoolGrade.GRADE_8],
            status: PublishStatus.PUBLISHED,
            creatorId,
            ...(subjectId && { subjectId }),
            ...(orgYearId && { academicYearId: orgYearId }),
          },
        });
      }

      let questions = await prisma.question.findMany({
        where: { testId: test.id },
        select: { id: true, type: true, correctAnswer: true, correctAnswers: true, score: true },
        orderBy: { order: 'asc' },
      });
      if (questions.length === 0) {
        const q1 = await prisma.question.create({
          data: {
            testId: test.id,
            text: 'Otázka 1 (pravda/nepravda)',
            type: QuestionType.TRUE_FALSE,
            order: 1,
            score: 1,
            correctAnswer: 'true',
          },
        });
        const q2 = await prisma.question.create({
          data: {
            testId: test.id,
            text: 'Otázka 2 (doplň)',
            type: QuestionType.FILL_IN_THE_BLANK,
            order: 2,
            score: 1,
            correctAnswer: 'správně',
          },
        });
        const q3 = await prisma.question.create({
          data: {
            testId: test.id,
            text: 'Otázka 3 (výběr)',
            type: QuestionType.MULTIPLE_CHOICE,
            order: 3,
            score: 1,
            correctAnswer: 'A',
            correctAnswers: ['A'],
          },
        });
        await prisma.option.createMany({
          data: [
            { questionId: q3.id, text: 'A' },
            { questionId: q3.id, text: 'B' },
            { questionId: q3.id, text: 'C' },
          ],
        });
        questions = [
          { id: q1.id, type: QuestionType.TRUE_FALSE,       correctAnswer: 'true',     correctAnswers: [],    score: 1 },
          { id: q2.id, type: QuestionType.FILL_IN_THE_BLANK, correctAnswer: 'správně',  correctAnswers: [],    score: 1 },
          { id: q3.id, type: QuestionType.MULTIPLE_CHOICE,   correctAnswer: 'A',        correctAnswers: ['A'], score: 1 },
        ];
      }
      allTests.push({
        id: test.id,
        orgId: org.id,
        testId: test.id,
        title: test.title,
        subjectId: test.subjectId ?? null,
        questionIds: questions.map((q) => q.id),
        questions: questions.map((q) => ({
          id: q.id,
          type: q.type,
          correctAnswer: q.correctAnswer ?? null,
          correctAnswers: q.correctAnswers ?? [],
          score: q.score ?? 1,
        })),
      });
    }
  }
  logDone(`Tests: ${allTests.length}`);
  return allTests;
}

// --- 6) ASSIGNMENTS (openAt/closeAt v minulosti, maxAttempts 1 nebo 2–3) ---
async function createAssignments(
  orgUsers: OrgUserIds[],
  sections: { id: string; orgId: string; yearId: string; label: string }[],
  tests: { id: string; orgId: string; testId: string; title: string; subjectId: string | null }[],
) {
  logStep('Assignments: per test, sensible open/close, maxAttempts 1 or 2–3');
  logStep('Assignments: linking tests to topics');
  const openAt = new Date('2025-10-01T08:00:00.000Z');
  const closeAt = new Date('2026-06-30T18:00:00.000Z');
  const assignments: {
    id: string;
    testId: string;
    classSectionId: string;
    maxAttempts: number;
    organizationId: string;
  }[] = [];
  let assignmentsWithTopics = 0;

  for (const test of tests) {
    if (!test.subjectId) {
      throw new Error(`Seed cannot resolve topic for test "${test.title}" (${test.testId}) because subjectId is missing`);
    }
    const orgSections = sections.filter(
      (s) => s.orgId === test.orgId && (s.label === '6.A' || s.label === '7.B'),
    );
    const creatorId = orgUsers.find(
      (u) => u.orgId === test.orgId,
    )?.creatorMembershipId;
    if (!creatorId) continue;

    for (const sec of orgSections) {
      const existing = await prisma.assignment.findFirst({
        where: {
          organizationId: test.orgId,
          testId: test.testId,
          classSectionId: sec.id,
        },
      });
      const topic = await resolveTopicForTest(test.title, test.subjectId);
      if (!topic) {
        throw new Error(`Seed cannot resolve topic for test "${test.title}" (${test.testId})`);
      }
      console.log(`  → ${test.title} → topic ${topic.name}`);
      const maxAttemptsFinal = sec.label === '6.A' ? 3 : 2;
      if (existing) {
        await prisma.assignment.update({
          where: { id: existing.id },
          data: {
            openAt,
            closeAt,
            maxAttempts: maxAttemptsFinal,
            topicLevelId: topic.id,
          },
        });
        console.log('  ↳ assignment already exists');
        assignmentsWithTopics += 1;
        assignments.push({
          id: existing.id,
          testId: test.testId,
          classSectionId: sec.id,
          maxAttempts: maxAttemptsFinal,
          organizationId: test.orgId,
        });
      } else {
        const a = await prisma.assignment.create({
          data: {
            organizationId: test.orgId,
            yearId: sec.yearId,
            testId: test.testId,
            targetType: 'CLASS',
            classSectionId: sec.id,
            topicLevelId: topic.id,
            openAt,
            closeAt,
            maxAttempts: maxAttemptsFinal,
            createdById: creatorId,
          },
        });
        assignmentsWithTopics += 1;
        assignments.push({
          id: a.id,
          testId: test.testId,
          classSectionId: sec.id,
          maxAttempts: maxAttemptsFinal,
          organizationId: test.orgId,
        });
      }
    }
  }
  const brokenAssignments = assignments.length
    ? await prisma.assignment.count({
        where: {
          id: { in: assignments.map((assignment) => assignment.id) },
          topicLevelId: null,
        },
      })
    : 0;
  if (brokenAssignments > 0) {
    throw new Error(`Seed produced ${brokenAssignments} assignments without topicLevelId`);
  }
  logDone(`Assignments with topics: ${assignmentsWithTopics}`);
  return assignments;
}

// --- 7) SUBMISSIONS (scénáře A–F) ---
// ---------------------------------------------------------------------------
// Seed scoring helpers
// ---------------------------------------------------------------------------

/** The givenText that will score as CORRECT for each question type. */
function correctGivenText(q: QuestionForScoring): string {
  if (q.type === QuestionType.MULTIPLE_CHOICE) {
    const answers = Array.isArray(q.correctAnswers) && (q.correctAnswers as unknown[]).length > 0
      ? (q.correctAnswers as string[])
      : q.correctAnswer
        ? [q.correctAnswer]
        : [];
    return answers.length > 1 ? JSON.stringify(answers) : (answers[0] ?? '');
  }
  return q.correctAnswer ?? '';
}

/** The givenText that will score as INCORRECT for each question type. */
function wrongGivenText(q: QuestionForScoring): string {
  if (q.type === QuestionType.TRUE_FALSE) {
    return q.correctAnswer === 'true' ? 'false' : 'true';
  }
  if (q.type === QuestionType.MULTIPLE_CHOICE) {
    return '["WRONG_SEED_ANSWER"]';
  }
  return 'nesprávně'; // FILL_IN_THE_BLANK
}

async function createSubmissions(
  orgUsers: OrgUserIds[],
  sections: { id: string; orgId: string; label: string }[],
  tests: { testId: string; orgId: string; questionIds: string[]; questions: QuestionForScoring[] }[],
  assignments: {
    id: string;
    testId: string;
    classSectionId: string;
    maxAttempts: number;
    organizationId: string;
  }[],
) {
  logStep(
    'Submissions: Student A–F scenarios (1 attempt, 2 attempts, 3 attempts, none, decline, 1 test only)',
  );

  // Reset all submissions for seeded demo students so repeated seed runs restore
  // the exact walkthrough scenarios even after manual/E2E runs created extra data.
  const seededStudentIds = orgUsers.flatMap((org) => org.studentMembershipIds);
  const deleted = await prisma.submission.deleteMany({
    where: { studentId: { in: seededStudentIds } },
  });
  if (deleted.count > 0) logStep(`Cleared ${deleted.count} stale submissions`);

  let created = 0;

  /**
   * Create one submission attempt and derive EVERY score-related field from
   * computeScore() — never from a hardcoded ratio.
   *
   * @param targetRatio  Desired outcome as a 0–1 ratio used ONLY to decide
   *                     how many questions to answer correctly.  The actual
   *                     stored score always comes from the engine.
   */
  const createSubmissionAttempt = async ({
    assignment,
    questions,
    studentId,
    attemptNo,
    targetRatio,
    submittedAt,
  }: {
    assignment: { id: string; testId: string; organizationId: string };
    questions: QuestionForScoring[];
    studentId: string;
    attemptNo: number;
    targetRatio: number;
    submittedAt: Date;
  }) => {
    const existing = await prisma.submission.findFirst({
      where: {
        organizationId: assignment.organizationId,
        assignmentId: assignment.id,
        studentId,
        attemptNo,
      },
    });
    if (existing) return false;

    // Build response data: first `correctCount` questions use the correct
    // answer text; the rest use a clearly wrong answer.
    const n = questions.length;
    const correctCount = Math.round(targetRatio * n);
    const responseInputs = questions.map((q, idx) => ({
      id: `seed-resp-${idx}`,
      questionId: q.id,
      givenText: idx < correctCount ? correctGivenText(q) : wrongGivenText(q),
    }));

    // Run through the real scoring engine — this is the single source of truth.
    const scoreResult = computeScore(questions, responseInputs);

    const submission = await prisma.submission.create({
      data: {
        organizationId: assignment.organizationId,
        assignmentId: assignment.id,
        testId: assignment.testId,
        studentId,
        status: SubmissionStatus.PENDING,
        attemptNo,
      },
    });

    // Write responses with engine-derived isCorrect / awardedPoints / maxPoints.
    await prisma.response.createMany({
      data: scoreResult.results.map((item) => {
        const q = questions.find((q) => q.id === item.questionId);
        return {
          submissionId: submission.id,
          questionId: item.questionId,
          givenText: responseInputs.find((r) => r.questionId === item.questionId)?.givenText ?? '',
          isCorrect: item.correct ?? false,
          awardedPoints: item.gained,
          maxPoints: q?.score ?? 1,
        };
      }),
    });

    // Finalise the submission with the engine-derived normalizedScore.
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.APPROVED,
        score: scoreResult.normalizedScore,
        submittedAt,
      },
    });

    return true;
  };

  for (const org of orgUsers) {
    const orgSections = sections.filter((s) => s.orgId === org.orgId);
    const class6A = orgSections.find((s) => s.label === '6.A');
    const class7B = orgSections.find((s) => s.label === '7.B');
    if (!class6A || !class7B) continue;

    const assign6A = assignments.filter((a) => a.classSectionId === class6A.id);
    const assign7B = assignments.filter((a) => a.classSectionId === class7B.id);
    const orgTests = tests.filter((t) => t.orgId === org.orgId);
    const test1 = orgTests[0];
    const test2 = orgTests[1];
    const test3 = orgTests[2];

    const studentKeys = [
      'studentA',
      'studentB',
      'studentC',
      'studentD',
      'studentE',
      'studentF',
    ] as const;
    const membershipIds = org.studentMembershipIds;

    for (let idx = 0; idx < 6; idx++) {
      const key = studentKeys[idx];
      const studentMembershipId = membershipIds[idx];
      if (!studentMembershipId) continue;
      const is6A = idx < 3;

      const assignList = is6A ? assign6A : assign7B;
      const asg1 = assignList[0];
      const asg2 = assignList[1];
      const asg3 = assignList[2];
      const t1 = test1;
      const t2 = test2;
      const t3 = test3;
      if (!asg1 || !t1?.questions.length) continue;

      const baseDate = new Date('2025-11-01T10:00:00.000Z');

      if (key === 'studentA') {
        const didCreate = await createSubmissionAttempt({
          assignment: asg1,
          questions: t1.questions,
          studentId: studentMembershipId,
          attemptNo: 1,
          targetRatio: 0.45,
          submittedAt: new Date(baseDate.getTime() + 60000),
        });
        if (didCreate) created++;
      }

      if (key === 'studentB' && asg1.maxAttempts >= 2) {
        const ratios: number[] = [0.4, 0.75];
        for (let attempt = 0; attempt < ratios.length; attempt++) {
          const targetRatio = ratios[attempt];
          if (targetRatio === undefined) continue;
          const didCreate = await createSubmissionAttempt({
            assignment: asg1,
            questions: t1.questions,
            studentId: studentMembershipId,
            attemptNo: attempt + 1,
            targetRatio,
            submittedAt: new Date(baseDate.getTime() + (attempt + 1) * 86400000),
          });
          if (didCreate) created++;
        }
      }

      if (key === 'studentC' && asg1.maxAttempts >= 3) {
        const ratios: number[] = [0.3, 0.5, 0.65];
        for (let attempt = 0; attempt < 3; attempt++) {
          const targetRatio = ratios[attempt];
          if (targetRatio === undefined) continue;
          const didCreate = await createSubmissionAttempt({
            assignment: asg1,
            questions: t1.questions,
            studentId: studentMembershipId,
            attemptNo: attempt + 1,
            targetRatio,
            submittedAt: new Date(baseDate.getTime() + (attempt + 1) * 86400000),
          });
          if (didCreate) created++;
        }
      }

      if (key === 'studentD') {
        continue;
      }

      if (key === 'studentE' && asg1.maxAttempts >= 2) {
        const ratios: number[] = [0.8, 0.6];
        for (let attempt = 0; attempt < ratios.length; attempt++) {
          const targetRatio = ratios[attempt];
          if (targetRatio === undefined) continue;
          const didCreate = await createSubmissionAttempt({
            assignment: asg1,
            questions: t1.questions,
            studentId: studentMembershipId,
            attemptNo: attempt + 1,
            targetRatio,
            submittedAt: new Date(baseDate.getTime() + (attempt + 1) * 86400000),
          });
          if (didCreate) created++;
        }
      }

      if (key === 'studentF') {
        const didCreate = await createSubmissionAttempt({
          assignment: asg1,
          questions: t1.questions,
          studentId: studentMembershipId,
          attemptNo: 1,
          targetRatio: 0.67,
          submittedAt: new Date(baseDate.getTime() + 60000),
        });
        if (didCreate) created++;
      }
    }
  }

  logDone(`Submissions: ${created} created/updated`);
}

async function cleanupGoldenFlowArtifacts(orgs: { id: string }[]) {
  logStep('Cleanup: removing stale Golden Flow E2E artifacts');

  const goldenTests = await prisma.test.findMany({
    where: {
      organizationId: { in: orgs.map((org) => org.id) },
      title: { startsWith: 'Golden Flow ' },
    },
    select: { id: true },
  });

  if (goldenTests.length === 0) {
    logDone('Cleanup: no stale Golden Flow tests');
    return;
  }

  await prisma.test.deleteMany({
    where: { id: { in: goldenTests.map((test) => test.id) } },
  });

  logDone(`Cleanup: removed ${goldenTests.length} stale Golden Flow tests`);
}

async function main() {
  console.log('🌱 Full walkthrough seed – start');
  await ensurePlatformBootstrapUsers();
  const orgs = await createOrganizations();
  const years = await createAcademicYears(orgs);
  const sections = await createClassSections(orgs, years);
  const orgUsers = await createUsersAndMembers(orgs);
  await createTeachers(orgUsers);
  await setHomeroomTeachers(orgUsers, sections);
  await createTeacherClassSections(orgUsers, sections);
  await createStudentsAndEnrollments(orgUsers, sections);
  const subjectsByOrg = await ensureCatalogAndSubjects(orgs);
  await attachOrgSubjectsToSeededClassSections(orgs, sections, subjectsByOrg);
  await cleanupGoldenFlowArtifacts(orgs);
  const tests = await createTests(orgs, orgUsers, years, subjectsByOrg);
  const assignments = await createAssignments(orgUsers, sections, tests);
  await createSubmissions(orgUsers, sections, tests, assignments);

  const [orgCount, studentCount, submissionCount] = await Promise.all([
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.student.count({ where: { deletedAt: null } }),
    prisma.submission.count({ where: { deletedAt: null } }),
  ]);

  console.log('\n--- Seed summary ---');
  console.log('Organizations:', orgCount);
  console.log('Students:', studentCount);
  console.log('Submissions:', submissionCount);

  printDemoBanner(
    [
      { email: 'director@zs.demo.local', org: ORG_NAMES.ZS, role: 'DIRECTOR' },
      { email: 'teacher1@zs.demo.local', org: ORG_NAMES.ZS, role: 'TEACHER' },
      { email: 'teacher2@zs.demo.local', org: ORG_NAMES.ZS, role: 'TEACHER' },
      { email: 'student-a@zs.demo.local', org: ORG_NAMES.ZS, role: 'STUDENT' },
      { email: 'student-b@zs.demo.local', org: ORG_NAMES.ZS, role: 'STUDENT' },
      { email: 'student-c@zs.demo.local', org: ORG_NAMES.ZS, role: 'STUDENT' },
      { email: 'student-d@zs.demo.local', org: ORG_NAMES.ZS, role: 'STUDENT' },
      { email: 'student-e@zs.demo.local', org: ORG_NAMES.ZS, role: 'STUDENT' },
      { email: 'student-f@zs.demo.local', org: ORG_NAMES.ZS, role: 'STUDENT' },
      {
        email: 'director@gym.demo.local',
        org: ORG_NAMES.GYM,
        role: 'DIRECTOR',
      },
      { email: 'teacher1@gym.demo.local', org: ORG_NAMES.GYM, role: 'TEACHER' },
      { email: 'teacher2@gym.demo.local', org: ORG_NAMES.GYM, role: 'TEACHER' },
      {
        email: 'student-a@gym.demo.local',
        org: ORG_NAMES.GYM,
        role: 'STUDENT',
      },
      {
        email: 'student-b@gym.demo.local',
        org: ORG_NAMES.GYM,
        role: 'STUDENT',
      },
      {
        email: 'student-c@gym.demo.local',
        org: ORG_NAMES.GYM,
        role: 'STUDENT',
      },
      {
        email: 'student-d@gym.demo.local',
        org: ORG_NAMES.GYM,
        role: 'STUDENT',
      },
      {
        email: 'student-e@gym.demo.local',
        org: ORG_NAMES.GYM,
        role: 'STUDENT',
      },
      {
        email: 'student-f@gym.demo.local',
        org: ORG_NAMES.GYM,
        role: 'STUDENT',
      },
      {
        email: 'director@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'DIRECTOR',
      },
      {
        email: 'teacher1@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'TEACHER',
      },
      {
        email: 'teacher2@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'TEACHER',
      },
      {
        email: 'student-a@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'STUDENT',
      },
      {
        email: 'student-b@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'STUDENT',
      },
      {
        email: 'student-c@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'STUDENT',
      },
      {
        email: 'student-d@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'STUDENT',
      },
      {
        email: 'student-e@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'STUDENT',
      },
      {
        email: 'student-f@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'STUDENT',
      },
    ],
    DEMO_PASSWORD,
  );

  console.log('✅ Full walkthrough seed – done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
