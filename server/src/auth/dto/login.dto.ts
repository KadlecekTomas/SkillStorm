import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({
    description:
      'Organization to log in as (JWT will be scoped to this org). User must be a member.',
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
