import { IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Username nebo e-mail',
    example: 'novakj | novak@zs-nova.cz',
  })
  @Transform(({ value, obj }) => value ?? obj.email)
  @IsString()
  login: string;

  @ApiProperty({
    description: 'Heslo',
    example: 'password123',
  })
  @IsString()
  password: string;
}
