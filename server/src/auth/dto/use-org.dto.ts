import { IsUUID } from 'class-validator';

export class UseOrgDto {
  @IsUUID()
  orgId!: string;
}
