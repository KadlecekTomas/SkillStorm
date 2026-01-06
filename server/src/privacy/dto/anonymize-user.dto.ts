import { IsUUID } from 'class-validator';

export class AnonymizeUserDto {
  @IsUUID()
  userId!: string;
}
