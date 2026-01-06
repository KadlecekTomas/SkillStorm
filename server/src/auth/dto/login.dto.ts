import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'E-mail',
    example: 'novak@zs-nova.cz',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Heslo',
    example: 'password123',
  })
  @IsString()
  password!: string;
}
