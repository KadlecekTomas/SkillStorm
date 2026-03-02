import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { StrongPassword, PASSWORD_POLICY_MESSAGE } from '@/common/validators/password.validator';

export enum RegisterMode {
  INDIVIDUAL = 'INDIVIDUAL',
  CREATE_ORG = 'CREATE_ORG',
  JOIN_ORG = 'JOIN_ORG',
}

export class RegisterDto {
  @ApiProperty({
    description: 'Jméno uživatele',
    example: 'Jan Novák',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({
    description: 'E-mail',
    example: 'jan.novak@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    description: 'Uživatelské jméno (volitelné; když nepřijde, vygeneruje se)',
    example: 'novakj',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({
    description: 'Heslo',
    example: 'password123',
    minLength: 8,
  })
  @IsString()
  @StrongPassword({ message: PASSWORD_POLICY_MESSAGE })
  password!: string;

  @ApiPropertyOptional({
    description: 'Systémová role',
    enum: SystemRole,
    example: SystemRole.SUPERADMIN,
  })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole;

  @ApiProperty({
    description:
      'Režim registrace. INDIVIDUAL = účet bez organizace, CREATE_ORG = založení vlastní školy, JOIN_ORG = registrace s následným připojením ke škole.',
    enum: RegisterMode,
    example: RegisterMode.INDIVIDUAL,
  })
  @Transform(({ value }) =>
    typeof value === 'string' && value.length ? value.toUpperCase() : undefined,
  )
  @IsEnum(RegisterMode)
  mode!: RegisterMode;

  @ApiPropertyOptional({
    description: 'Invitation token for JOIN_ORG (required for join mode)',
    example: 'invite-token-from-link',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((o) => o.mode === RegisterMode.JOIN_ORG && o.inviteToken !== undefined)
  @IsString()
  @IsNotEmpty()
  inviteToken?: string;

  @ApiPropertyOptional({
    description: 'Legacy invite code (backward compatibility). Internally mapped to inviteToken.',
    example: 'invite-token-from-link',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((o) => o.mode === RegisterMode.JOIN_ORG && o.code !== undefined)
  @IsString()
  @IsNotEmpty()
  code?: string;

  /** Ignored at register. Required in onboarding step (POST /organizations). Kept optional so clients can send it without 400. */
  @ApiPropertyOptional({ description: 'Ignored. Use POST /organizations in onboarding step.' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  organizationName?: string;
}
