import { SchoolGrade, SyncMode } from '@prisma/client';
import {
  buildDefaultMockData,
  type MockDirectoryData,
} from '../directory/mock-google-workspace-directory.client';
import {
  buildPreview,
  type ExistingState,
  type PreviewBuilderInput,
} from './preview-builder';

function emptyExisting(): ExistingState {
  return {
    userIdentityByExternalId: new Map(),
    userByEmail: new Map(),
    membershipUserIdsInOrg: new Set(),
    classSectionByGradeSection: new Map(),
    groupIdentityByExternalId: new Map(),
  };
}

function toInput(
  data: MockDirectoryData,
  existing: ExistingState = emptyExisting(),
): PreviewBuilderInput {
  return {
    users: data.users,
    groups: data.groups,
    membersByGroupId: new Map(Object.entries(data.members)),
    existing,
  };
}

describe('buildPreview', () => {
  it('summarises the fixture directory correctly', () => {
    const preview = buildPreview(toInput(buildDefaultMockData()));

    expect(preview.summary.usersFound).toBe(4);
    expect(preview.summary.groupsFound).toBe(4);
    expect(preview.summary.classGroupsDetected).toBe(1);
    expect(preview.summary.studentsDetected).toBe(2);
    expect(preview.summary.teachersDetected).toBe(1);
    expect(preview.summary.directorsDetected).toBe(1);
    // lyzak-2026 is not a class/teacher/director group → unresolved.
    expect(preview.summary.unresolvedGroupsCount).toBe(1);
    expect(preview.unresolvedGroups[0]?.externalGroupEmail).toBe(
      'lyzak-2026@skola.cz',
    );
  });

  it('maps the class group to a 7.A class section to create', () => {
    const preview = buildPreview(toInput(buildDefaultMockData()));
    expect(preview.classMappings).toHaveLength(1);
    const klass = preview.classMappings[0]!;
    expect(klass.grade).toBe(SchoolGrade.GRADE_7);
    expect(klass.section).toBe('A');
    expect(klass.action).toBe('CREATE');
    expect(preview.classSectionsToCreate).toHaveLength(1);
    expect(preview.enrollmentsToCreate).toHaveLength(2);
  });

  it('is deterministic and idempotent (two runs are identical)', () => {
    const a = buildPreview(toInput(buildDefaultMockData()));
    const b = buildPreview(toInput(buildDefaultMockData()));
    expect(JSON.stringify(b)).toEqual(JSON.stringify(a));
  });

  it('treats users with an existing external identity as UPDATE, not CREATE', () => {
    const existing = emptyExisting();
    existing.userIdentityByExternalId.set('g-user-1', {
      userId: 'local-user-1',
      membershipId: 'mem-1',
    });
    existing.membershipUserIdsInOrg.add('local-user-1');

    const preview = buildPreview(toInput(buildDefaultMockData(), existing));
    const created = preview.usersToCreate.map((u) => u.externalId);
    const updated = preview.usersToUpdate.map((u) => u.externalId);
    expect(created).not.toContain('g-user-1');
    expect(updated).toContain('g-user-1');
    // Existing membership → not re-created.
    expect(
      preview.membershipsToCreate.map((u) => u.externalId),
    ).not.toContain('g-user-1');
  });

  it('emits a ROLE_CONFLICT warning and resolves to the higher role', () => {
    const data = buildDefaultMockData();
    // Put the director (g-user-4) into the class group too → STUDENT + DIRECTOR.
    data.members['g-group-7a'] = [
      ...data.members['g-group-7a']!,
      { id: 'g-user-4', email: 'reditel@skola.cz', role: 'MEMBER', type: 'USER', raw: {} },
    ];
    const preview = buildPreview(toInput(data));

    const conflict = preview.warnings.find((w) => w.code === 'ROLE_CONFLICT');
    expect(conflict).toBeDefined();
    expect(preview.summary.conflictsCount).toBeGreaterThanOrEqual(1);
    // Director stays DIRECTOR despite being in the class group.
    const director = [
      ...preview.usersToCreate,
      ...preview.usersToUpdate,
    ].find((u) => u.externalId === 'g-user-4');
    expect(director?.role).toBe('DIRECTOR');
  });

  it('locks class mapping when the existing GROUP identity is a manual override', () => {
    const existing = emptyExisting();
    existing.groupIdentityByExternalId.set('g-group-7a', {
      classSectionId: 'cs-existing',
      syncMode: SyncMode.MANUAL_OVERRIDE,
    });
    const preview = buildPreview(toInput(buildDefaultMockData(), existing));
    const klass = preview.classMappings.find(
      (c) => c.externalGroupId === 'g-group-7a',
    );
    expect(klass?.locked).toBe(true);
    expect(klass?.action).toBe('MAP_EXISTING');
    expect(klass?.existingClassSectionId).toBe('cs-existing');
  });

  it('excludes groups matching excludedGroupPatterns', () => {
    const preview = buildPreview({
      ...toInput(buildDefaultMockData()),
      patterns: { excludedGroupPatterns: ['^lyzak'] },
    });
    expect(preview.unresolvedGroups).toHaveLength(0);
  });
});
