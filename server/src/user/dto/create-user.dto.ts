import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { $Enums } from '../../../generated/prisma';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsEnum($Enums.Role)
  role: $Enums.Role;
}
