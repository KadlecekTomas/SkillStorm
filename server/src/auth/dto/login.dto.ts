import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Username nebo e-mail',
    example: 'novakj | novak@zs-nova.cz',
  })
  @IsString()
  login: string;

  @ApiProperty({
    description: 'Heslo',
    example: 'password123',
  })
  @IsString()
  password: string;
}
