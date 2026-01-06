import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateTeacherDto {
  @ApiProperty({ example: 'membership-uuid' })
  @IsUUID()
  membershipId!: string;

  @ApiProperty({ example: 'organization-uuid' })
  @IsUUID()
  organizationId!: string;
}
