import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { GoogleWorkspaceService } from './google-workspace.service';

/**
 * Centralized, provider-level OAuth endpoints for Google Workspace onboarding.
 *
 * These routes are NOT under the org-scoped controller because the
 * `redirect_uri` registered in Google Cloud Console must be a single fixed URL
 * — the `organizationId` travels inside the signed `state`, never in the path.
 *
 * They are `@Public()` (no session required): the security boundary is the
 * HMAC-signed, short-lived `state` minted by the org-scoped, permission-checked
 * `GET …/auth-url`. A forged or edited state fails signature verification, so a
 * different organization can never be connected by URL tampering. The callback
 * only ever issues a redirect and never echoes the code/token into the URL.
 */
@ApiExcludeController()
@Controller()
export class GoogleWorkspaceOAuthController {
  constructor(private readonly service: GoogleWorkspaceService) {}

  @Public()
  @Get('integrations/google-workspace/oauth/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.service.handleCallback({ code, state, error });
    return res.redirect(result.redirectUrl);
  }

  /**
   * Dev-only mock connect target (NODE_ENV !== production +
   * GOOGLE_WORKSPACE_MOCK_MODE=true). The service hard-rejects with 404 when
   * mock mode is off, so this can never be a production bypass.
   */
  @Public()
  @Get('dev/google-workspace/mock-connect')
  async mockConnect(
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.service.mockConnect(state);
    return res.redirect(result.redirectUrl);
  }
}
