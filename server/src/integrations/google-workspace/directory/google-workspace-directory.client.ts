import { Injectable, Logger } from '@nestjs/common';
import type {
  DirectoryScope,
  GoogleWorkspaceDirectoryClient,
  GoogleWorkspaceGroup,
  GoogleWorkspaceGroupMember,
  GoogleWorkspaceOrgUnit,
  GoogleWorkspaceUser,
} from './google-workspace.types';

const DIRECTORY_BASE = 'https://admin.googleapis.com/admin/directory/v1';

/**
 * A directory client bound to a single OAuth access token. Pagination is fully
 * resolved internally; only normalised internal types leave this class. Raw
 * Google payloads are kept on `.raw` but never logged.
 */
class HttpGoogleWorkspaceDirectoryClient
  implements GoogleWorkspaceDirectoryClient
{
  private readonly logger = new Logger(HttpGoogleWorkspaceDirectoryClient.name);

  constructor(private readonly accessToken: string) {}

  async listUsers(scope: DirectoryScope): Promise<GoogleWorkspaceUser[]> {
    const params: Record<string, string> = { maxResults: '200' };
    if (scope.customerId) params.customer = scope.customerId;
    else if (scope.domain) params.domain = scope.domain;
    else params.customer = 'my_customer';

    const raw = await this.paginate<Record<string, any>>(
      '/users',
      params,
      'users',
    );
    return raw.map((u) => ({
      id: String(u.id),
      primaryEmail: String(u.primaryEmail ?? '').toLowerCase(),
      nameFullName: String(u.name?.fullName ?? ''),
      givenName: String(u.name?.givenName ?? ''),
      familyName: String(u.name?.familyName ?? ''),
      suspended: Boolean(u.suspended),
      archived: Boolean(u.archived),
      isAdmin: Boolean(u.isAdmin),
      raw: u,
      ...(u.orgUnitPath ? { orgUnitPath: String(u.orgUnitPath) } : {}),
    }));
  }

  async listGroups(scope: DirectoryScope): Promise<GoogleWorkspaceGroup[]> {
    const params: Record<string, string> = { maxResults: '200' };
    if (scope.customerId) params.customer = scope.customerId;
    else if (scope.domain) params.domain = scope.domain;
    else params.customer = 'my_customer';

    const raw = await this.paginate<Record<string, any>>(
      '/groups',
      params,
      'groups',
    );
    return raw.map((g) => ({
      id: String(g.id),
      email: String(g.email ?? '').toLowerCase(),
      name: String(g.name ?? ''),
      raw: g,
      ...(g.description ? { description: String(g.description) } : {}),
    }));
  }

  async listGroupMembers(
    groupKey: string,
  ): Promise<GoogleWorkspaceGroupMember[]> {
    const raw = await this.paginate<Record<string, any>>(
      `/groups/${encodeURIComponent(groupKey)}/members`,
      { maxResults: '200' },
      'members',
    );
    return raw.map((m) => ({
      id: String(m.id ?? m.email),
      email: String(m.email ?? '').toLowerCase(),
      role: String(m.role ?? 'MEMBER'),
      type: String(m.type ?? 'USER'),
      raw: m,
    }));
  }

  async listOrgUnits(customerId: string): Promise<GoogleWorkspaceOrgUnit[]> {
    // orgunits is not paginated like the others — it returns a flat tree.
    const data = await this.request<Record<string, any>>(
      `/customer/${encodeURIComponent(customerId)}/orgunits`,
      { type: 'all' },
    );
    const units: any[] = Array.isArray(data.organizationUnits)
      ? data.organizationUnits
      : [];
    return units.map((o) => ({
      orgUnitId: String(o.orgUnitId ?? ''),
      orgUnitPath: String(o.orgUnitPath ?? ''),
      name: String(o.name ?? ''),
      raw: o,
    }));
  }

  private async paginate<T>(
    path: string,
    baseParams: Record<string, string>,
    collectionKey: string,
  ): Promise<T[]> {
    const out: T[] = [];
    let pageToken: string | undefined;
    // Hard cap to avoid runaway loops against a misbehaving API.
    for (let page = 0; page < 1000; page += 1) {
      const params = { ...baseParams };
      if (pageToken) params.pageToken = pageToken;
      const data = await this.request<Record<string, any>>(path, params);
      const items = data[collectionKey];
      if (Array.isArray(items)) out.push(...(items as T[]));
      pageToken = data.nextPageToken ? String(data.nextPageToken) : undefined;
      if (!pageToken) break;
    }
    return out;
  }

  private async request<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<T> {
    const url = `${DIRECTORY_BASE}${path}?${new URLSearchParams(params).toString()}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      // Never include the access token or response body that might echo it.
      this.logger.warn(
        `Directory API ${path} responded ${res.status} ${res.statusText}`,
      );
      throw new Error(
        `Google Directory API request failed (${res.status}). Path: ${path}`,
      );
    }
    return (await res.json()) as T;
  }
}

/**
 * Produces directory clients bound to a given OAuth access token. Injected so
 * tests can substitute a mock (see GOOGLE_WORKSPACE_DIRECTORY_CLIENT token).
 */
export interface GoogleWorkspaceDirectoryClientFactory {
  create(accessToken: string): GoogleWorkspaceDirectoryClient;
}

@Injectable()
export class HttpGoogleWorkspaceDirectoryClientFactory
  implements GoogleWorkspaceDirectoryClientFactory
{
  create(accessToken: string): GoogleWorkspaceDirectoryClient {
    return new HttpGoogleWorkspaceDirectoryClient(accessToken);
  }
}
