import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrganizationRole } from '@prisma/client';

export class SwitchRoleDto {
  @ApiProperty({
    description:
      'Role, na kterou se přepíná aktivní kontext (musí být aktivně přiřazená aktivnímu membershipu)',
    enum: OrganizationRole,
    example: OrganizationRole.PARENT,
  })
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
