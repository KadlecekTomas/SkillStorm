import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrganizationRole } from '@prisma/client';

export class AssignRoleDto {
  @ApiProperty({
    description: 'Role, která se membershipu přidává (STUDENT je exkluzivní)',
    enum: OrganizationRole,
    example: OrganizationRole.PARENT,
  })
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
