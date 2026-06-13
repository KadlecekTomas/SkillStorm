import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class PlatformCreateCatalogTopicDto {
  @ApiProperty({ example: 'catalog-subject-id' })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ example: 'Fractions' })
  @IsString()
  @Length(2, 255)
  name!: string;

  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
