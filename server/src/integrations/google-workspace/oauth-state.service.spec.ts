import { OAuthStateService } from './oauth-state.service';
import type { GoogleWorkspaceConfigService } from './google-workspace-config.service';
import type { PrismaService } from '@/prisma/prisma.service';
import { OAUTH_STATE_TTL_MS } from './google-workspace.constants';

/** Minimal in-memory stand-in for prisma.googleOAuthNonce. */
export function fakeNonceStore() {
  const rows = new Map<
    string,
    {
      nonce: string;
      organizationId: string;
      userId: string;
      expiresAt: Date;
      usedAt: Date | null;
    }
  >();
  const prisma = {
    googleOAuthNonce: {
      create: jest.fn(async ({ data }: any) => {
        rows.set(data.nonce, { ...data, usedAt: null });
        return data;
      }),
      findUnique: jest.fn(async ({ where: { nonce } }: any) => {
        const r = rows.get(nonce);
        return r ? { ...r } : null;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const r = rows.get(where.nonce);
        if (r && r.usedAt == null) {
          r.usedAt = data.usedAt;
          return { count: 1 };
        }
        return { count: 0 };
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
  } as unknown as PrismaService;
  return { prisma, rows };
}

function makeService(secret = 'state-secret') {
  const { prisma, rows } = fakeNonceStore();
  const config = { stateSecret: secret } as unknown as GoogleWorkspaceConfigService;
  return { svc: new OAuthStateService(prisma, config), prisma, rows, config };
}

describe('OAuthStateService (one-time nonce)', () => {
  it('issues a state that consumes exactly once', async () => {
    const { svc } = makeService();
    const state = await svc.issue({ organizationId: 'org-1', userId: 'user-1' });
    const r = await svc.consume(state);
    expect(r).toEqual({ ok: true, organizationId: 'org-1', userId: 'user-1' });
  });

  it('rejects a replayed state (REPLAYED)', async () => {
    const { svc } = makeService();
    const state = await svc.issue({ organizationId: 'org-1', userId: 'user-1' });
    expect((await svc.consume(state)).ok).toBe(true);
    expect(await svc.consume(state)).toEqual({ ok: false, reason: 'REPLAYED' });
  });

  it('rejects a tampered signature (INVALID)', async () => {
    const { svc } = makeService();
    const state = await svc.issue({ organizationId: 'org-1', userId: 'user-1' });
    const tampered = `${state.split('.')[0]}.deadbeef`;
    expect(await svc.consume(tampered)).toEqual({ ok: false, reason: 'INVALID' });
  });

  it('rejects a state signed with a different secret (INVALID)', async () => {
    const a = makeService('secret-a');
    const state = await a.svc.issue({ organizationId: 'o', userId: 'u' });
    // Different secret, but share the same store so the nonce row exists.
    const b = new OAuthStateService(a.prisma, {
      stateSecret: 'secret-b',
    } as unknown as GoogleWorkspaceConfigService);
    expect(await b.consume(state)).toEqual({ ok: false, reason: 'INVALID' });
  });

  it('rejects an unknown nonce that is otherwise validly signed (INVALID)', async () => {
    const { svc, rows } = makeService();
    const state = await svc.issue({ organizationId: 'org-1', userId: 'user-1' });
    rows.clear(); // nonce no longer persisted
    expect(await svc.consume(state)).toEqual({ ok: false, reason: 'INVALID' });
  });

  it('rejects an expired state (EXPIRED)', async () => {
    const { svc } = makeService();
    const t0 = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(t0);
    const state = await svc.issue({ organizationId: 'org-1', userId: 'user-1' });
    jest.spyOn(Date, 'now').mockReturnValue(t0 + OAUTH_STATE_TTL_MS + 1);
    expect(await svc.consume(state)).toEqual({ ok: false, reason: 'EXPIRED' });
    (Date.now as jest.Mock).mockRestore();
  });

  it('rejects malformed / empty input (INVALID)', async () => {
    const { svc } = makeService();
    expect(await svc.consume(undefined)).toEqual({ ok: false, reason: 'INVALID' });
    expect(await svc.consume('no-dot')).toEqual({ ok: false, reason: 'INVALID' });
  });
});
