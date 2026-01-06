import { IsEnum, IsUUID } from 'class-validator';
import { OrganizationRole } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMembershipDto {
  @ApiProperty({ example: 'user-id-uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ example: 'organization-id-uuid' })
  @IsUUID()
  organizationId!: string;

  @ApiProperty({ enum: OrganizationRole, example: 'STUDENT' })
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
