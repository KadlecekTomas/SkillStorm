import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { $Enums } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'jdoe' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    enum: $Enums.SystemRole,
    example: $Enums.SystemRole.SUPERADMIN,
    description: 'Povoleno nastavovat pouze SUPERADMINovi',
  })
  @IsOptional()
  @IsEnum($Enums.SystemRole)
  systemRole?: $Enums.SystemRole;

  @ApiPropertyOptional({ example: 'cs-CZ' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  preferredLang?: string;
}
