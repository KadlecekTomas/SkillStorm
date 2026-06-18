import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Payload for the OAuth authorization-code exchange. The frontend obtains the
 * `authorizationCode` from Google's consent redirect (see CONNECT TODO in the
 * service) and POSTs it here; the backend exchanges it for tokens and stores
 * them encrypted. `organizationId` is taken from the route param, not the body
 * — included here only for symmetry / non-route callers.
 */
export class ConnectGoogleWorkspaceDto {
  @ApiProperty({ example: '4/0Aean...authorization-code' })
  @IsString()
  authorizationCode!: string;

  @ApiPropertyOptional({ example: 'org-uuid' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  /** Optional CSRF/state echo from the OAuth redirect. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;
}
