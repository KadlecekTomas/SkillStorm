import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { $Enums } from '../../../generated/prisma';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'The name of the user',
    example: 'John Doe',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({
    description: 'The email of the user',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'The role of the user',
    enum: $Enums.Role,
    example: 'TEACHER',
  })
  @IsEnum($Enums.Role)
  role: $Enums.Role;

  @ApiProperty({
    description:
      'The password of the user (plain text, will be hashed on backend)',
    example: 'StrongPassword123!',
  })
  @IsString()
  @MinLength(8)
  password: string;
}
