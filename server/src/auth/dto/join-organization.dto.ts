import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { OrganizationRole } from '@prisma/client';
import { Transform } from 'class-transformer';

export class JoinOrganizationDto {
  @ApiProperty({
    description: 'Kód organizace (aktuálně organizationId).',
    example: 'organization-id-uuid',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  joinCode!: string;

  @ApiProperty({
    enum: OrganizationRole,
    example: OrganizationRole.STUDENT,
  })
  @IsEnum(OrganizationRole)
  @Transform(({ value }) =>
    typeof value === 'string' && value.length ? value.toUpperCase() : value,
  )
  role!: OrganizationRole;
}
