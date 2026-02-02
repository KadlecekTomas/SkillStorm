import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrganizationRole } from '@prisma/client';
import { Transform } from 'class-transformer';

export class AcceptInviteDto {
  @ApiProperty({ description: 'Invite code (or legacy: organizationId for ORG_ONLY)' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  code!: string;

  @ApiPropertyOptional({
    description: 'Role for ORG_ONLY invites (TEACHER/DIRECTOR). Ignored for STUDENT_CLASS.',
    enum: [OrganizationRole.TEACHER, OrganizationRole.DIRECTOR],
  })
  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;
}
