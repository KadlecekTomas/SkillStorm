import { SchoolGrade, SyncMode } from '@prisma/client';
import {
  DEFAULT_CLASS_GROUP_PATTERNS,
  DEFAULT_DIRECTOR_GROUP_PATTERNS,
  DEFAULT_TEACHER_GROUP_PATTERNS,
} from '@/integrations/google-workspace/google-workspace.constants';
import type {
  GoogleWorkspaceGroup,
  GoogleWorkspaceGroupMember,
  GoogleWorkspaceUser,
} from '@/integrations/google-workspace/directory/google-workspace.types';
import {
  CLASS_CONFIDENCE_THRESHOLD,
  parseClassGroup,
} from './class-group-parser';
import {
  detectGroupRole,
  detectOrgUnitRole,
  resolveRole,
  type DetectedRole,
} from './role-detector';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface PreviewPatterns {
  classGroupPatterns?: string[];
  teacherGroupPatterns?: string[];
  directorGroupPatterns?: string[];
  excludedGroupPatterns?: string[];
}

/** Snapshot of relevant existing SkillStorm state, loaded by the orchestrator. */
export interface ExistingState {
  /** Google user id → already-linked local user/membership. */
  userIdentityByExternalId: Map<
    string,
    { userId: string; membershipId: string | null }
  >;
  /** Normalized e-mail → existing local user. */
  userByEmail: Map<string, { id: string }>;
  /** Local user ids that already hold a membership in this organization. */
  membershipUserIdsInOrg: Set<string>;
  /** `${grade}|${section}` → existing class section in the target year. */
  classSectionByGradeSection: Map<string, { id: string; label: string | null }>;
  /** Google group id → existing GROUP external-identity mapping. */
  groupIdentityByExternalId: Map<
    string,
    { classSectionId: string | null; syncMode: SyncMode }
  >;
}

export interface PreviewBuilderInput {
  users: GoogleWorkspaceUser[];
  groups: GoogleWorkspaceGroup[];
  membersByGroupId: Map<string, GoogleWorkspaceGroupMember[]>;
  patterns?: PreviewPatterns;
  existing: ExistingState;
}

// ---------------------------------------------------------------------------
// Plan (consumed by commit) + response (returned to the API)
// ---------------------------------------------------------------------------

export type UserAction = 'CREATE' | 'UPDATE' | 'LINK';
export type ClassAction = 'CREATE' | 'MAP_EXISTING' | 'IGNORE';

export interface UserPlan {
  externalId: string;
  email: string;
  displayName: string;
  givenName: string;
  familyName: string;
  role: DetectedRole;
  roleConflict: boolean;
  roleCandidates: DetectedRole[];
  suspended: boolean;
  action: UserAction;
  existingUserId: string | null;
  existingMembershipId: string | null;
  needsMembership: boolean;
}

export interface ClassPlan {
  externalGroupId: string;
  externalGroupEmail: string;
  externalGroupName: string;
  grade: SchoolGrade;
  section: string;
  label: string;
  confidence: number;
  action: ClassAction;
  existingClassSectionId: string | null;
  /** Existing GROUP mapping is locked by a manual override / ignore flag. */
  locked: boolean;
}

export interface EnrollmentPlan {
  externalUserId: string;
  externalGroupId: string;
}

export interface RoleMapping {
  sourceType: 'GROUP' | 'ORG_UNIT' | 'EMAIL_PATTERN';
  externalId?: string;
  pattern?: string;
  role: DetectedRole;
  confidence: number;
}

export interface UnresolvedGroup {
  externalGroupId: string;
  externalGroupEmail: string;
  externalGroupName: string;
  reason: string;
  confidence: number;
}

export interface PreviewIssue {
  severity: 'INFO' | 'WARNING' | 'ERROR';
  code: string;
  message: string;
  payload?: Record<string, unknown>;
}

export interface GoogleWorkspacePreview {
  summary: {
    usersFound: number;
    groupsFound: number;
    classGroupsDetected: number;
    studentsDetected: number;
    teachersDetected: number;
    directorsDetected: number;
    unresolvedGroupsCount: number;
    conflictsCount: number;
  };
  classMappings: ClassPlan[];
  roleMappings: RoleMapping[];
  usersToCreate: PreviewUser[];
  usersToUpdate: PreviewUser[];
  membershipsToCreate: PreviewUser[];
  classSectionsToCreate: ClassPlan[];
  enrollmentsToCreate: EnrollmentPlan[];
  enrollmentsToDeactivate: EnrollmentPlan[];
  unresolvedGroups: UnresolvedGroup[];
  warnings: PreviewIssue[];
  errors: PreviewIssue[];
  /** Internal plan reused by commit. Not part of the public contract. */
  plan: {
    users: UserPlan[];
    classes: ClassPlan[];
    enrollments: EnrollmentPlan[];
  };
}

/** Trimmed user shape for the API (never exposes raw Google payload). */
export interface PreviewUser {
  externalId: string;
  email: string;
  displayName: string;
  role: DetectedRole;
}

function toPreviewUser(plan: UserPlan): PreviewUser {
  return {
    externalId: plan.externalId,
    email: plan.email,
    displayName: plan.displayName,
    role: plan.role,
  };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Pure, deterministic preview builder. Given the Google directory snapshot and
 * the relevant existing SkillStorm state, it computes the full import plan
 * WITHOUT touching the database. Output ordering is stable (sorted by
 * e-mail / label) so repeated runs are byte-identical.
 *
 * Note: `enrollmentsToDeactivate` is left empty here — it is inherently a
 * DB-diff (which previously-synced students are no longer in any Google class
 * group) and is filled in by the orchestrator.
 */
export function buildPreview(
  input: PreviewBuilderInput,
): GoogleWorkspacePreview {
  const classPatterns =
    input.patterns?.classGroupPatterns ?? DEFAULT_CLASS_GROUP_PATTERNS;
  const rolePatterns = {
    teacherGroupPatterns:
      input.patterns?.teacherGroupPatterns ?? DEFAULT_TEACHER_GROUP_PATTERNS,
    directorGroupPatterns:
      input.patterns?.directorGroupPatterns ?? DEFAULT_DIRECTOR_GROUP_PATTERNS,
  };
  const excluded = input.patterns?.excludedGroupPatterns ?? [];
  const excludedRegexes = excluded.map((p) => new RegExp(p, 'i'));

  const warnings: PreviewIssue[] = [];
  const errors: PreviewIssue[] = [];

  // --- 1. Classify groups -------------------------------------------------
  const classGroups = new Map<string, ClassPlan>();
  const roleMappings: RoleMapping[] = [];
  const unresolvedGroups: UnresolvedGroup[] = [];
  // group id → role contributed to its members
  const groupRoleById = new Map<string, DetectedRole>();

  for (const group of input.groups) {
    const isExcluded = excludedRegexes.some(
      (rx) => rx.test(group.email) || rx.test(group.name),
    );
    if (isExcluded) continue;

    const groupRole = detectGroupRole(group, rolePatterns);
    if (groupRole === 'DIRECTOR' || groupRole === 'TEACHER') {
      groupRoleById.set(group.id, groupRole);
      roleMappings.push({
        sourceType: 'GROUP',
        externalId: group.id,
        role: groupRole,
        confidence: 1,
      });
      continue;
    }

    const parsed = parseClassGroup(
      { email: group.email, name: group.name },
      classPatterns,
    );
    if (
      parsed.matched &&
      parsed.grade &&
      parsed.section &&
      parsed.confidence >= CLASS_CONFIDENCE_THRESHOLD
    ) {
      groupRoleById.set(group.id, 'STUDENT');
      const key = `${parsed.grade}|${parsed.section}`;
      const existingMapping = input.existing.groupIdentityByExternalId.get(
        group.id,
      );
      const existingSection =
        input.existing.classSectionByGradeSection.get(key);
      const locked =
        existingMapping?.syncMode === SyncMode.MANUAL_OVERRIDE ||
        existingMapping?.syncMode === SyncMode.IGNORED;

      const existingClassSectionId =
        existingMapping?.classSectionId ?? existingSection?.id ?? null;

      classGroups.set(group.id, {
        externalGroupId: group.id,
        externalGroupEmail: group.email,
        externalGroupName: group.name,
        grade: parsed.grade,
        section: parsed.section,
        label: parsed.label ?? `${parsed.section}`,
        confidence: parsed.confidence,
        action: existingClassSectionId ? 'MAP_EXISTING' : 'CREATE',
        existingClassSectionId,
        locked,
      });
      continue;
    }

    // Anything left is an unresolved group: surfaced, never an error.
    unresolvedGroups.push({
      externalGroupId: group.id,
      externalGroupEmail: group.email,
      externalGroupName: group.name,
      reason: parsed.matched ? 'LOW_CONFIDENCE_CLASS_MATCH' : 'NO_RULE_MATCHED',
      confidence: parsed.confidence,
    });
  }

  // --- 2. Resolve per-user roles -----------------------------------------
  const userById = new Map<string, GoogleWorkspaceUser>();
  for (const u of input.users) userById.set(u.id, u);

  // Collect role signals per user id from group memberships.
  const roleSignals = new Map<string, DetectedRole[]>();
  const studentGroupsByUser = new Map<string, Set<string>>();
  const warnedNested = new Set<string>();
  const warnedMissingUser = new Set<string>();
  for (const [groupId, members] of input.membersByGroupId.entries()) {
    const role = groupRoleById.get(groupId);
    if (!role) continue;
    for (const member of members) {
      // Nested groups (a group as a member of another group) are not expanded
      // in the MVP — surfaced as a warning and ignored, never crashing.
      if (member.type !== 'USER') {
        const key = `${groupId}:${member.id}`;
        if (!warnedNested.has(key)) {
          warnedNested.add(key);
          warnings.push({
            severity: 'WARNING',
            code: 'NESTED_GROUP_MEMBER_IGNORED',
            message: `Vnořená skupina ${member.email || member.id} ve skupině ${groupId} byla ignorována (nested groups nejsou v MVP rozbalovány).`,
            payload: { groupId, memberId: member.id, type: member.type },
          });
        }
        continue;
      }
      // A member referencing a user not present in the directory snapshot
      // (e.g. external/Gmail member) cannot be mapped — warn and skip.
      if (!userById.has(member.id)) {
        if (!warnedMissingUser.has(member.id)) {
          warnedMissingUser.add(member.id);
          warnings.push({
            severity: 'WARNING',
            code: 'MEMBER_USER_NOT_FOUND',
            message: `Člen ${member.email || member.id} nemá odpovídající Google uživatelský záznam; přeskočen.`,
            payload: { memberId: member.id, email: member.email },
          });
        }
        continue;
      }
      const signals = roleSignals.get(member.id) ?? [];
      signals.push(role);
      roleSignals.set(member.id, signals);
      if (role === 'STUDENT' && classGroups.has(groupId)) {
        const set = studentGroupsByUser.get(member.id) ?? new Set<string>();
        set.add(groupId);
        studentGroupsByUser.set(member.id, set);
      }
    }
  }

  // Add org-unit signals for every directory user.
  for (const user of input.users) {
    const ouRole = detectOrgUnitRole(user.orgUnitPath);
    if (ouRole) {
      const signals = roleSignals.get(user.id) ?? [];
      signals.push(ouRole);
      roleSignals.set(user.id, signals);
    }
  }

  // Distinct org-unit role mappings (for transparency in the preview).
  const seenOrgUnit = new Set<string>();
  for (const user of input.users) {
    const ouRole = detectOrgUnitRole(user.orgUnitPath);
    if (ouRole && user.orgUnitPath && !seenOrgUnit.has(user.orgUnitPath)) {
      seenOrgUnit.add(user.orgUnitPath);
      roleMappings.push({
        sourceType: 'ORG_UNIT',
        pattern: user.orgUnitPath,
        role: ouRole,
        confidence: 0.9,
      });
    }
  }

  // --- 3. Build user plans ------------------------------------------------
  const userPlans: UserPlan[] = [];
  let conflictsCount = 0;
  for (const [externalId, signals] of roleSignals.entries()) {
    const user = userById.get(externalId);
    if (!user) continue;
    const resolution = resolveRole(signals);
    if (!resolution) continue;

    if (resolution.conflict) {
      conflictsCount += 1;
      warnings.push({
        severity: 'WARNING',
        code: 'ROLE_CONFLICT',
        message: `Uživatel ${user.primaryEmail} má konfliktní role; zvolena ${resolution.role}.`,
        payload: {
          externalId,
          email: user.primaryEmail,
          candidates: resolution.candidates,
          chosen: resolution.role,
        },
      });
    }
    if (user.suspended) {
      warnings.push({
        severity: 'WARNING',
        code: 'USER_SUSPENDED',
        message: `Uživatel ${user.primaryEmail} je v Google pozastaven.`,
        payload: { externalId, email: user.primaryEmail },
      });
    }

    const email = user.primaryEmail.toLowerCase();
    const linked = input.existing.userIdentityByExternalId.get(externalId);
    const byEmail = input.existing.userByEmail.get(email);

    let action: UserAction;
    let existingUserId: string | null = null;
    let existingMembershipId: string | null = null;
    if (linked) {
      action = 'UPDATE';
      existingUserId = linked.userId;
      existingMembershipId = linked.membershipId;
    } else if (byEmail) {
      action = 'LINK';
      existingUserId = byEmail.id;
    } else {
      action = 'CREATE';
    }

    const hasMembership =
      Boolean(existingMembershipId) ||
      (existingUserId
        ? input.existing.membershipUserIdsInOrg.has(existingUserId)
        : false);

    userPlans.push({
      externalId,
      email,
      displayName: user.nameFullName || user.primaryEmail,
      givenName: user.givenName,
      familyName: user.familyName,
      role: resolution.role,
      roleConflict: resolution.conflict,
      roleCandidates: resolution.candidates,
      suspended: user.suspended,
      action,
      existingUserId,
      existingMembershipId,
      needsMembership: !hasMembership,
    });
  }

  userPlans.sort((a, b) => a.email.localeCompare(b.email));

  // --- 4. Build enrollment plans -----------------------------------------
  const studentRoleByUser = new Map<string, DetectedRole>();
  for (const plan of userPlans)
    studentRoleByUser.set(plan.externalId, plan.role);

  const enrollmentPlans: EnrollmentPlan[] = [];
  for (const [externalUserId, groupIds] of studentGroupsByUser.entries()) {
    if (studentRoleByUser.get(externalUserId) !== 'STUDENT') continue;
    const sortedGroups = Array.from(groupIds).sort();
    if (sortedGroups.length > 1) {
      warnings.push({
        severity: 'WARNING',
        code: 'STUDENT_MULTIPLE_CLASSES',
        message: `Student ${externalUserId} je členem více tříd; použita první dle pořadí.`,
        payload: { externalUserId, groups: sortedGroups },
      });
    }
    const chosen = sortedGroups[0];
    if (chosen && classGroups.has(chosen)) {
      enrollmentPlans.push({ externalUserId, externalGroupId: chosen });
    }
  }
  enrollmentPlans.sort(
    (a, b) =>
      a.externalGroupId.localeCompare(b.externalGroupId) ||
      a.externalUserId.localeCompare(b.externalUserId),
  );

  // --- 5. Sort outputs & derive response ---------------------------------
  const classPlans = Array.from(classGroups.values()).sort(
    (a, b) =>
      a.label.localeCompare(b.label) ||
      a.externalGroupEmail.localeCompare(b.externalGroupEmail),
  );
  roleMappings.sort(
    (a, b) =>
      a.sourceType.localeCompare(b.sourceType) ||
      (a.externalId ?? a.pattern ?? '').localeCompare(
        b.externalId ?? b.pattern ?? '',
      ),
  );
  unresolvedGroups.sort((a, b) =>
    a.externalGroupEmail.localeCompare(b.externalGroupEmail),
  );

  const usersToCreate = userPlans.filter((u) => u.action === 'CREATE');
  const usersToUpdate = userPlans.filter((u) => u.action !== 'CREATE');
  const membershipsToCreate = userPlans.filter((u) => u.needsMembership);
  const classSectionsToCreate = classPlans.filter((c) => c.action === 'CREATE');

  const studentsDetected = userPlans.filter((u) => u.role === 'STUDENT').length;
  const teachersDetected = userPlans.filter((u) => u.role === 'TEACHER').length;
  const directorsDetected = userPlans.filter(
    (u) => u.role === 'DIRECTOR',
  ).length;

  return {
    summary: {
      usersFound: input.users.length,
      groupsFound: input.groups.length,
      classGroupsDetected: classPlans.length,
      studentsDetected,
      teachersDetected,
      directorsDetected,
      unresolvedGroupsCount: unresolvedGroups.length,
      conflictsCount,
    },
    classMappings: classPlans,
    roleMappings,
    usersToCreate: usersToCreate.map(toPreviewUser),
    usersToUpdate: usersToUpdate.map(toPreviewUser),
    membershipsToCreate: membershipsToCreate.map(toPreviewUser),
    classSectionsToCreate,
    enrollmentsToCreate: enrollmentPlans,
    enrollmentsToDeactivate: [],
    unresolvedGroups,
    warnings,
    errors,
    plan: {
      users: userPlans,
      classes: classPlans,
      enrollments: enrollmentPlans,
    },
  };
}
