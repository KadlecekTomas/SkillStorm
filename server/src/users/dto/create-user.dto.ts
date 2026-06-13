import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  Matches,
  MaxLength,
} from 'class-validator';
import { SystemRole } from '@prisma/client';

const PASSWORD_POLICY = {
  message:
    'Heslo musí mít alespoň 8 znaků, obsahovat alespoň jedno písmeno a jednu číslici.',
};

export class CreateUserDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'jdoe' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: PASSWORD_POLICY.message })
  @Matches(/\d/, { message: PASSWORD_POLICY.message })
  @Matches(/[a-zA-Z]/, { message: PASSWORD_POLICY.message })
  password!: string;

  @ApiPropertyOptional({
    enum: SystemRole,
    example: SystemRole.SUPERADMIN,
    description: 'Povoleno nastavovat pouze SUPERADMINovi',
  })
  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole;

  @ApiPropertyOptional({ example: 'cs-CZ' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  preferredLang?: string;
}
