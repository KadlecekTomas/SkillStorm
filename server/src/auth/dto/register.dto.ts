import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { Transform } from 'class-transformer';

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
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({
    description: 'Role v organizaci (použije se při JOIN_ORG během explicitního připojení)',
    enum: OrganizationRole,
    example: OrganizationRole.TEACHER,
  })
  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;

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
    description:
      'Kód organizace pro JOIN_ORG (aktuálně organizationId) – použije se při explicitním připojení.',
    example: 'organization-id-uuid',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  joinCode?: string;
}
