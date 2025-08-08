import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({
    description: 'Jméno uživatele',
    example: 'Jan Novák',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({
    description: 'E-mail (volitelné – může být null)',
    example: 'jan.novak@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

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

  @ApiPropertyOptional({
    description: 'Systémová role',
    enum: SystemRole,
    example: SystemRole.SUPERADMIN,
  })
  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole;
}
