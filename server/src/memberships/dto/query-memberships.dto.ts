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
import { OrganizationRole } from '@prisma/client';

export class QueryMembershipsDto {
  @ApiPropertyOptional({
    description: 'ID organizace, ve které listujeme členy',
    example: '3b1b9f1b-6a6f-4a0d-9a33-3a27f7f6b9c1',
  })
  @IsOptional()
  @IsUUID('4')
  organizationId!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Fulltext přes uživatele (name, email, username)',
    example: 'Novák',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtr role v organizaci',
    enum: OrganizationRole,
    example: 'TEACHER',
  })
  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;
}
