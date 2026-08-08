import { IsEmail, IsString, MinLength } from 'class-validator';

export class UpdateSchoolPersonDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;
}
