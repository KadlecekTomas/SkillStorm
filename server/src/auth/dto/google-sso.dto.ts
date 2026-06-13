import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class GoogleSsoLoginDto {
  @ApiProperty({
    description: 'Google ID token obtained by the client (GIS / One Tap).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  idToken!: string;

  @ApiPropertyOptional({
    description:
      'Organization scope. When provided, the organization must have Google SSO enabled and the e-mail domain must pass its allowlist.',
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
