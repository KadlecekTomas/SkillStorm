import { SchoolGrade } from '@prisma/client';
import {
  buildDefaultMockData,
  type MockDirectoryData,
} from '../directory/mock-google-workspace-directory.client';
import {
  buildPreview,
  type ExistingState,
  type PreviewBuilderInput,
} from './preview-builder';
import type { GoogleWorkspaceGroupMember } from '../directory/google-workspace.types';

function emptyExisting(): ExistingState {
  return {
    userIdentityByExternalId: new Map(),
    userByEmail: new Map(),
    membershipUserIdsInOrg: new Set(),
    classSectionByGradeSection: new Map(),
    groupIdentityByExternalId: new Map(),
  };
}

function toInput(data: MockDirectoryData): PreviewBuilderInput {
  return {
    users: data.users,
    groups: data.groups,
    membersByGroupId: new Map(Object.entries(data.members)),
    existing: emptyExisting(),
  };
}

function member(
  id: string,
  email: string,
  type = 'USER',
): GoogleWorkspaceGroupMember {
  return { id, email, role: 'MEMBER', type, raw: {} };
}

describe('buildPreview edge cases', () => {
  it('flags suspended users with a warning (not silently active)', () => {
    const data = buildDefaultMockData();
    data.users = data.users.map((u) =>
      u.id === 'g-user-1' ? { ...u, suspended: true } : u,
    );
    const preview = buildPreview(toInput(data));
    const warn = preview.warnings.find(
      (w) => w.code === 'USER_SUSPENDED' && (w.payload as any)?.externalId === 'g-user-1',
    );
    expect(warn).toBeDefined();
  });

  it('warns and ignores nested group members (type GROUP)', () => {
    const data = buildDefaultMockData();
    data.members['g-group-7a'] = [
      ...data.members['g-group-7a']!,
      member('g-group-nested', 'subgroup@skola.cz', 'GROUP'),
    ];
    const preview = buildPreview(toInput(data));
    expect(
      preview.warnings.some((w) => w.code === 'NESTED_GROUP_MEMBER_IGNORED'),
    ).toBe(true);
    // Nested group never becomes a user/enrollment.
    expect(
      preview.enrollmentsToCreate.some(
        (e) => e.externalUserId === 'g-group-nested',
      ),
    ).toBe(false);
  });

  it('warns when a member has no matching directory user', () => {
    const data = buildDefaultMockData();
    data.members['g-group-7a'] = [
      ...data.members['g-group-7a']!,
      member('g-ghost', 'ghost@skola.cz'),
    ];
    const preview = buildPreview(toInput(data));
    expect(
      preview.warnings.some((w) => w.code === 'MEMBER_USER_NOT_FOUND'),
    ).toBe(true);
    expect(preview.summary.studentsDetected).toBe(2); // ghost not counted
  });

  it('handles a user in two class groups in the same year (warning + single enrollment)', () => {
    const data = buildDefaultMockData();
    // Add a second class group containing Alice as well.
    data.groups.push({
      id: 'g-group-7b',
      email: 'trida-7b@skola.cz',
      name: 'Třída 7.B',
      raw: {},
    });
    data.members['g-group-7b'] = [
      member('g-user-1', 'alice.student@skola.cz'),
    ];
    const preview = buildPreview(toInput(data));
    expect(
      preview.warnings.some((w) => w.code === 'STUDENT_MULTIPLE_CLASSES'),
    ).toBe(true);
    // Alice is enrolled into exactly one class.
    const aliceEnrollments = preview.enrollmentsToCreate.filter(
      (e) => e.externalUserId === 'g-user-1',
    );
    expect(aliceEnrollments).toHaveLength(1);
  });

  it('keeps a teacher who is also in a class group as TEACHER', () => {
    const data = buildDefaultMockData();
    // Put the teacher (g-user-3) into the class group too.
    data.members['g-group-7a'] = [
      ...data.members['g-group-7a']!,
      member('g-user-3', 'novak.teacher@skola.cz'),
    ];
    const preview = buildPreview(toInput(data));
    const teacher = [
      ...preview.usersToCreate,
      ...preview.usersToUpdate,
    ].find((u) => u.externalId === 'g-user-3');
    expect(teacher?.role).toBe('TEACHER');
    // Not enrolled as a student.
    expect(
      preview.enrollmentsToCreate.some((e) => e.externalUserId === 'g-user-3'),
    ).toBe(false);
  });

  it('does not crash on an empty class group', () => {
    const data = buildDefaultMockData();
    data.groups.push({
      id: 'g-group-9z',
      email: 'trida-9z@skola.cz',
      name: 'Třída 9.Z',
      raw: {},
    });
    data.members['g-group-9z'] = [];
    const preview = buildPreview(toInput(data));
    const klass = preview.classMappings.find(
      (c) => c.externalGroupId === 'g-group-9z',
    );
    expect(klass?.grade).toBe(SchoolGrade.GRADE_9);
    // Detected as a class but with no enrollments.
    expect(
      preview.enrollmentsToCreate.some((e) => e.externalGroupId === 'g-group-9z'),
    ).toBe(false);
  });

  it('an unresolved group never blocks the preview', () => {
    const data = buildDefaultMockData();
    const preview = buildPreview(toInput(data));
    // lyzak-2026 is unresolved, yet the rest of the preview is fully built.
    expect(preview.summary.unresolvedGroupsCount).toBeGreaterThanOrEqual(1);
    expect(preview.classMappings.length).toBeGreaterThanOrEqual(1);
    expect(preview.errors).toHaveLength(0);
  });
});
