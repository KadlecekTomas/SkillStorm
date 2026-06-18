import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GOOGLE_WORKSPACE_SCOPES } from './google-workspace.constants';

/**
 * Central, fail-soft configuration for the Google Workspace integration.
 *
 * The integration is OPTIONAL: if the OAuth client / encryption key are not
 * configured the application must still boot. `isConfigured()` lets callers
 * (controller, OAuth connect) reject requests with a clean 4xx instead of
 * crashing on startup. Nothing here ever logs secret values.
 */
@Injectable()
export class GoogleWorkspaceConfigService {
  private readonly logger = new Logger(GoogleWorkspaceConfigService.name);

  constructor(private readonly config: ConfigService) {}

  get clientId(): string | undefined {
    return this.config.get<string>('GOOGLE_WORKSPACE_CLIENT_ID') || undefined;
  }

  get clientSecret(): string | undefined {
    return (
      this.config.get<string>('GOOGLE_WORKSPACE_CLIENT_SECRET') || undefined
    );
  }

  get redirectUri(): string | undefined {
    return (
      this.config.get<string>('GOOGLE_WORKSPACE_REDIRECT_URI') || undefined
    );
  }

  /** Raw 32-byte AES key material (hex or base64), used by TokenEncryptionService. */
  get encryptionKey(): string | undefined {
    return (
      this.config.get<string>('GOOGLE_INTEGRATION_ENCRYPTION_KEY') || undefined
    );
  }

  get scopes(): string[] {
    return [...GOOGLE_WORKSPACE_SCOPES];
  }

  /**
   * Dev-only mock onboarding: skip the real Google consent + token exchange and
   * use the in-memory fixture directory. Hard-disabled in production regardless
   * of the env value, so it can never become a prod bypass.
   */
  get mockMode(): boolean {
    if (process.env.NODE_ENV === 'production') return false;
    return this.config.get<string>('GOOGLE_WORKSPACE_MOCK_MODE') === 'true';
  }

  /** Public frontend origin the OAuth callback redirects back to. */
  get publicAppUrl(): string {
    return this.config.get<string>('PUBLIC_APP_URL') || 'http://localhost:3000';
  }

  /** Public backend origin (used to build the dev mock-connect URL). */
  get apiBaseUrl(): string {
    return this.config.get<string>('API_URL') || 'http://localhost:4200';
  }

  /**
   * Secret used to HMAC-sign the OAuth `state`. Reuses an existing strong
   * server secret so no new env var is required; never leaves the server.
   */
  get stateSecret(): string {
    return (
      this.config.get<string>('JWT_ACCESS_SECRET') ||
      this.config.get<string>('COOKIE_SECRET') ||
      this.encryptionKey ||
      'insecure-dev-state-secret'
    );
  }

  /**
   * True only when every secret required to actually talk to Google and store
   * tokens is present. When false the feature degrades gracefully: the module
   * still loads, but connect/preview/commit refuse with a clear error.
   */
  isConfigured(): boolean {
    return Boolean(
      this.clientId &&
        this.clientSecret &&
        this.redirectUri &&
        this.encryptionKey,
    );
  }

  /** Build the consent URL for the OAuth authorization-code flow. */
  buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId ?? '',
      redirect_uri: this.redirectUri ?? '',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      scope: this.scopes.join(' '),
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
}
