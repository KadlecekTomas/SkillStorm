// src/modules/teachers/dto/query-teachers.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

const optionalTrimmed = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class QueryTeachersDto {
  @ApiPropertyOptional({
    description: 'ID organizace, ve které listujeme učitele',
    example: '3b1b9f1b-6a6f-4a0d-9a33-3a27f7f6b9c1',
  })
  @IsOptional()
  @Transform(optionalTrimmed)
  @IsUUID('4')
  organizationId?: string;

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
    description: 'Fulltext (jméno, email, uživatelské jméno)',
    example: 'Novák',
  })
  @IsOptional()
  @Transform(optionalTrimmed)
  @IsString()
  search?: string;
}
