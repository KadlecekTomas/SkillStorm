import { IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const PASSWORD_POLICY = {
  message: 'Heslo musí mít alespoň 8 znaků, obsahovat alespoň jedno písmeno a jednu číslici.',
};

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token z e-mailu' })
  @IsString()
  token!: string;

  @ApiProperty({ description: 'Nové heslo', minLength: 8 })
  @IsString()
  @MinLength(8, { message: PASSWORD_POLICY.message })
  @Matches(/\d/, { message: PASSWORD_POLICY.message })
  @Matches(/[a-zA-Z]/, { message: PASSWORD_POLICY.message })
  newPassword!: string;
}
