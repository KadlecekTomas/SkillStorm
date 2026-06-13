import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  StrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from '@/common/validators/password.validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Současné heslo' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ description: 'Nové heslo', minLength: 8 })
  @IsString()
  @StrongPassword({ message: PASSWORD_POLICY_MESSAGE })
  newPassword!: string;
}
