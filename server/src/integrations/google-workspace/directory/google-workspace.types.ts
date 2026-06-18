/**
 * Normalised, internal representations of Google Workspace Directory objects.
 *
 * The directory client is the ONLY place that touches raw Google API
 * responses. Everything downstream (mapping, preview, commit) consumes these
 * stable internal shapes so that a future provider swap or API change is
 * contained. `raw` keeps the original object for audit/debugging but must
 * never be returned wholesale to the frontend.
 */

export interface GoogleWorkspaceUser {
  /** Immutable Google user id — the identity anchor (never the e-mail). */
  id: string;
  primaryEmail: string;
  nameFullName: string;
  givenName: string;
  familyName: string;
  suspended: boolean;
  archived?: boolean;
  orgUnitPath?: string;
  isAdmin?: boolean;
  raw: unknown;
}

export interface GoogleWorkspaceGroup {
  /** Immutable Google group id. */
  id: string;
  email: string;
  name: string;
  description?: string;
  raw: unknown;
}

export interface GoogleWorkspaceGroupMember {
  /** Immutable Google id of the member (matches a user's `id` when type=USER). */
  id: string;
  email: string;
  role: string;
  type: string;
  raw: unknown;
}

export interface GoogleWorkspaceOrgUnit {
  orgUnitId: string;
  orgUnitPath: string;
  name: string;
  raw: unknown;
}

/**
 * Read-only Directory API surface used by the onboarding flow. All methods
 * must handle pagination internally and return fully-materialised arrays of
 * normalised types — callers never see `nextPageToken`.
 */
export interface GoogleWorkspaceDirectoryClient {
  listUsers(scope: DirectoryScope): Promise<GoogleWorkspaceUser[]>;
  listGroups(scope: DirectoryScope): Promise<GoogleWorkspaceGroup[]>;
  listGroupMembers(groupKey: string): Promise<GoogleWorkspaceGroupMember[]>;
  listOrgUnits(customerId: string): Promise<GoogleWorkspaceOrgUnit[]>;
}

/** Either a primary domain or a customerId identifies the directory tenant. */
export interface DirectoryScope {
  domain?: string;
  customerId?: string;
}
