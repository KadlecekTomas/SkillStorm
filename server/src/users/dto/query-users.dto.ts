import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { $Enums } from '@prisma/client';

export class QueryUsersDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Fulltext: name, email, username',
    example: 'novak',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Filtrovat dle organizace (povoleno jen SUPERADMINovi). Ředitel má implicitně vlastní org.',
    example: 'organization-uuid',
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Filtrovat dle organizační role (přes Memberships)',
    enum: $Enums.OrganizationRole,
    example: $Enums.OrganizationRole.TEACHER,
  })
  @IsOptional()
  @IsEnum($Enums.OrganizationRole)
  hasOrgRole?: $Enums.OrganizationRole;

  @ApiPropertyOptional({
    description: 'Řazení podle pole',
    enum: ['name', 'email', 'username', 'lastLoginAt'] as const,
    example: 'name',
  })
  @IsOptional()
  @IsString()
  orderBy?: 'name' | 'email' | 'username' | 'lastLoginAt' = 'name';

  @ApiPropertyOptional({
    description: 'Směr řazení',
    enum: ['asc', 'desc'] as const,
    example: 'asc',
  })
  @IsOptional()
  @IsString()
  orderDir?: 'asc' | 'desc' = 'asc';
}
