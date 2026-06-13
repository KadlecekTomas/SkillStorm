import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type GoogleIdentityProfile = {
  /** Google account `sub` — stable, globally unique subject identifier. */
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  /** Google Workspace hosted domain (`hd` claim), if the account belongs to one. */
  hostedDomain: string | null;
};

const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * Server-side verification of a Google ID token via Google's tokeninfo
 * endpoint. Injectable so it can be swapped for `google-auth-library`
 * (local signature verification) without touching the SSO service.
 */
@Injectable()
export class GoogleTokenVerifier {
  private readonly logger = new Logger(GoogleTokenVerifier.name);

  constructor(private readonly config: ConfigService) {}

  async verify(idToken: string): Promise<GoogleIdentityProfile> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new UnauthorizedException('Google SSO is not configured.');
    }

    let payload: Record<string, unknown>;
    try {
      const response = await fetch(
        `${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`,
      );
      if (!response.ok) {
        throw new UnauthorizedException('Invalid Google token.');
      }
      payload = (await response.json()) as Record<string, unknown>;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error(
        'Google tokeninfo verification failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw new UnauthorizedException('Google token verification failed.');
    }

    if (
      typeof payload.iss !== 'string' ||
      !GOOGLE_ISSUERS.includes(payload.iss)
    ) {
      throw new UnauthorizedException('Invalid Google token issuer.');
    }
    if (payload.aud !== clientId) {
      throw new UnauthorizedException('Google token audience mismatch.');
    }
    const expMs = Number(payload.exp) * 1000;
    if (!Number.isFinite(expMs) || expMs <= Date.now()) {
      throw new UnauthorizedException('Google token expired.');
    }
    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new UnauthorizedException('Google token has no subject.');
    }

    return {
      subject: payload.sub,
      email:
        typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
      emailVerified:
        payload.email_verified === true || payload.email_verified === 'true',
      name: typeof payload.name === 'string' ? payload.name : null,
      hostedDomain: typeof payload.hd === 'string' ? payload.hd : null,
    };
  }
}
