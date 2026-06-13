import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  StrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from '@/common/validators/password.validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token z e-mailu' })
  @IsString()
  token!: string;

  @ApiProperty({ description: 'Nové heslo', minLength: 8 })
  @IsString()
  @StrongPassword({ message: PASSWORD_POLICY_MESSAGE })
  newPassword!: string;
}
