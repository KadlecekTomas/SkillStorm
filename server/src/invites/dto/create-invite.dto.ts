import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { InvitationType, OrganizationRole } from '@prisma/client';

export class CreateInviteDto {
  @ApiProperty({ enum: InvitationType })
  @IsEnum(InvitationType)
  type!: InvitationType;

  @ApiPropertyOptional({ enum: OrganizationRole })
  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  yearId?: string;

  @ApiPropertyOptional({ description: 'Expiry in days from now', default: 7 })
  @IsOptional()
  expiresInDays?: number;
}
