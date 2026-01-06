import { IsEnum } from 'class-validator';
import { OrganizationRole } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMembershipDto {
  @ApiProperty({ enum: OrganizationRole, example: 'TEACHER' })
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
