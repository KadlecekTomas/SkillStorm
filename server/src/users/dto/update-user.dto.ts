import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { SystemRole } from '@prisma/client';

const PASSWORD_POLICY = {
  message:
    'Heslo musí mít alespoň 8 znaků, obsahovat alespoň jedno písmeno a jednu číslici.',
};

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'jdoe' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'newpassword123', minLength: 8 })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.password != null && o.password !== '')
  @MinLength(8, { message: PASSWORD_POLICY.message })
  @Matches(/\d/, { message: PASSWORD_POLICY.message })
  @Matches(/[a-zA-Z]/, { message: PASSWORD_POLICY.message })
  password?: string;

  @ApiPropertyOptional({
    enum: SystemRole,
    example: SystemRole.SUPERADMIN,
    description: 'Povoleno měnit pouze SUPERADMINovi',
  })
  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole;

  @ApiPropertyOptional({ example: 'en-US' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  preferredLang?: string;
}
