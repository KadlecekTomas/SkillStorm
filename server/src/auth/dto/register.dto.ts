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

export class RegisterDto {
  @ApiProperty({
    description: 'Jméno uživatele',
    example: 'Jan Novák',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({
    description: 'E-mail',
    example: 'jan.novak@example.com',
  })
  @IsEmail()
  email: string;

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
  password: string;

  @ApiProperty({
    description: 'Role v organizaci',
    enum: OrganizationRole,
    example: OrganizationRole.TEACHER,
  })
  @IsEnum(OrganizationRole)
  role: OrganizationRole;

  @ApiPropertyOptional({
    description: 'Systémová role',
    enum: SystemRole,
    example: SystemRole.SUPERADMIN,
  })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole;
}
