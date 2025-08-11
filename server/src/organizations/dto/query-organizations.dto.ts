import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { OrganizationType } from '@prisma/client';

export class QueryOrganizationsDto {
  @ApiPropertyOptional({
    description: 'Fulltext (název, město, země)',
    example: 'Praha',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  search?: string;

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
    description: 'Filtr podle typu organizace',
    enum: OrganizationType,
    example: 'SCHOOL',
  })
  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;
}
