import type { GoogleWorkspaceDirectoryClientFactory } from './google-workspace-directory.client';
import type {
  DirectoryScope,
  GoogleWorkspaceDirectoryClient,
  GoogleWorkspaceGroup,
  GoogleWorkspaceGroupMember,
  GoogleWorkspaceOrgUnit,
  GoogleWorkspaceUser,
} from './google-workspace.types';

/**
 * Deterministic in-memory directory client for tests and local dry-runs.
 * Mirrors the fixture data described in the onboarding spec. No network calls.
 */
export interface MockDirectoryData {
  users: GoogleWorkspaceUser[];
  groups: GoogleWorkspaceGroup[];
  members: Record<string, GoogleWorkspaceGroupMember[]>;
  orgUnits: GoogleWorkspaceOrgUnit[];
}

function user(
  id: string,
  email: string,
  given: string,
  family: string,
  extra: Partial<GoogleWorkspaceUser> = {},
): GoogleWorkspaceUser {
  return {
    id,
    primaryEmail: email,
    nameFullName: `${given} ${family}`.trim(),
    givenName: given,
    familyName: family,
    suspended: false,
    archived: false,
    raw: { id, primaryEmail: email },
    ...extra,
  };
}

function group(id: string, email: string, name: string): GoogleWorkspaceGroup {
  return { id, email, name, raw: { id, email, name } };
}

function member(u: GoogleWorkspaceUser): GoogleWorkspaceGroupMember {
  return {
    id: u.id,
    email: u.primaryEmail,
    role: 'MEMBER',
    type: 'USER',
    raw: { id: u.id, email: u.primaryEmail },
  };
}

/** The canonical fixture set from the onboarding spec. */
export function buildDefaultMockData(): MockDirectoryData {
  const alice = user('g-user-1', 'alice.student@skola.cz', 'Alice', 'Student', {
    orgUnitPath: '/Zaci',
  });
  const bob = user('g-user-2', 'bob.student@skola.cz', 'Bob', 'Student', {
    orgUnitPath: '/Zaci',
  });
  const novak = user('g-user-3', 'novak.teacher@skola.cz', 'Jan', 'Novak', {
    orgUnitPath: '/Zamestnanci/Ucitele',
  });
  const reditel = user('g-user-4', 'reditel@skola.cz', 'Petr', 'Reditel', {
    orgUnitPath: '/Zamestnanci/Ucitele',
  });

  return {
    users: [alice, bob, novak, reditel],
    groups: [
      group('g-group-7a', 'trida-7a@skola.cz', 'Třída 7.A'),
      group('g-group-teachers', 'ucitele@skola.cz', 'Učitelé'),
      group('g-group-management', 'vedeni@skola.cz', 'Vedení'),
      group('g-group-unresolved', 'lyzak-2026@skola.cz', 'Lyžařský kurz 2026'),
    ],
    members: {
      'g-group-7a': [member(alice), member(bob)],
      'g-group-teachers': [member(novak)],
      'g-group-management': [member(reditel)],
      'g-group-unresolved': [member(alice), member(novak)],
    },
    orgUnits: [
      {
        orgUnitId: 'ou-1',
        orgUnitPath: '/Zaci',
        name: 'Žáci',
        raw: {},
      },
      {
        orgUnitId: 'ou-2',
        orgUnitPath: '/Zamestnanci/Ucitele',
        name: 'Učitelé',
        raw: {},
      },
    ],
  };
}

export class MockGoogleWorkspaceDirectoryClient
  implements GoogleWorkspaceDirectoryClient
{
  constructor(private readonly data: MockDirectoryData) {}

  async listUsers(_scope: DirectoryScope): Promise<GoogleWorkspaceUser[]> {
    return [...this.data.users];
  }

  async listGroups(_scope: DirectoryScope): Promise<GoogleWorkspaceGroup[]> {
    return [...this.data.groups];
  }

  async listGroupMembers(
    groupKey: string,
  ): Promise<GoogleWorkspaceGroupMember[]> {
    const byId = this.data.members[groupKey];
    if (byId) return [...byId];
    // Allow lookup by e-mail too (the orchestrator may key on either).
    const grp = this.data.groups.find((g) => g.email === groupKey);
    const byEmail = grp ? this.data.members[grp.id] : undefined;
    return byEmail ? [...byEmail] : [];
  }

  async listOrgUnits(_customerId: string): Promise<GoogleWorkspaceOrgUnit[]> {
    return [...this.data.orgUnits];
  }
}

export class MockGoogleWorkspaceDirectoryClientFactory
  implements GoogleWorkspaceDirectoryClientFactory
{
  constructor(
    private readonly data: MockDirectoryData = buildDefaultMockData(),
  ) {}

  create(_accessToken: string): GoogleWorkspaceDirectoryClient {
    return new MockGoogleWorkspaceDirectoryClient(this.data);
  }
}
