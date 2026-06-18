import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { GoogleWorkspaceConfigService } from './google-workspace-config.service';
import { OAUTH_STATE_TTL_MS } from './google-workspace.constants';

interface OAuthStatePayload {
  organizationId: string;
  userId: string;
  exp: number;
  nonce: string;
}

export type ConsumeReason = 'INVALID' | 'EXPIRED' | 'REPLAYED';

export type ConsumeResult =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; reason: ConsumeReason };

/**
 * Tamper-proof, **one-time** OAuth `state`.
 *
 * The payload is HMAC-signed over a server secret (so `organizationId`/`userId`
 * cannot be edited in the redirect URL) AND its `nonce` is persisted at issue
 * time and consumed exactly once at the callback. This defeats replay of a
 * captured `state`+`code` pair:
 *  - bad signature / malformed / unknown nonce → INVALID
 *  - expired (token exp or stored expiry)       → EXPIRED
 *  - nonce already used (or lost a concurrent consume race) → REPLAYED
 *
 * The `state` is minted only inside the org-scoped, permission-checked
 * `auth-url` endpoint, so a valid+unused state proves the connect was
 * authorized for that organization.
 */
@Injectable()
export class OAuthStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: GoogleWorkspaceConfigService,
  ) {}

  async issue(input: {
    organizationId: string;
    userId: string;
  }): Promise<string> {
    const nonce = randomBytes(16).toString('hex');
    const exp = Date.now() + OAUTH_STATE_TTL_MS;
    await this.prisma.googleOAuthNonce.create({
      data: {
        nonce,
        organizationId: input.organizationId,
        userId: input.userId,
        expiresAt: new Date(exp),
      },
    });
    // Best-effort housekeeping of stale nonces (never blocks issuing).
    this.prisma.googleOAuthNonce
      .deleteMany({
        where: { expiresAt: { lt: new Date(Date.now() - OAUTH_STATE_TTL_MS) } },
      })
      .catch(() => undefined);

    const payload: OAuthStatePayload = {
      organizationId: input.organizationId,
      userId: input.userId,
      exp,
      nonce,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${this.hmac(body)}`;
  }

  async consume(state: string | undefined | null): Promise<ConsumeResult> {
    const payload = this.verifySignature(state);
    if (!payload) return { ok: false, reason: 'INVALID' };
    if (payload.exp < Date.now()) return { ok: false, reason: 'EXPIRED' };

    const row = await this.prisma.googleOAuthNonce.findUnique({
      where: { nonce: payload.nonce },
      select: {
        organizationId: true,
        userId: true,
        usedAt: true,
        expiresAt: true,
      },
    });
    if (!row) return { ok: false, reason: 'INVALID' };
    if (row.usedAt) return { ok: false, reason: 'REPLAYED' };
    if (row.expiresAt.getTime() < Date.now()) {
      return { ok: false, reason: 'EXPIRED' };
    }

    // Atomic one-time consume: only the first caller flips usedAt null → now.
    const consumed = await this.prisma.googleOAuthNonce.updateMany({
      where: { nonce: payload.nonce, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0) return { ok: false, reason: 'REPLAYED' };

    // Use the persisted (authoritative) org/user, not just the token claims.
    return { ok: true, organizationId: row.organizationId, userId: row.userId };
  }

  private verifySignature(
    state: string | undefined | null,
  ): OAuthStatePayload | null {
    if (!state || typeof state !== 'string') return null;
    const dot = state.lastIndexOf('.');
    if (dot <= 0) return null;
    const body = state.slice(0, dot);
    const sig = state.slice(dot + 1);

    const expected = this.hmac(body);
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    try {
      const payload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as OAuthStatePayload;
      if (
        !payload.organizationId ||
        !payload.userId ||
        !payload.nonce ||
        typeof payload.exp !== 'number'
      ) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  private hmac(body: string): string {
    return createHmac('sha256', this.config.stateSecret)
      .update(body)
      .digest('base64url');
  }
}
