import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssignTestsDto {
  @ApiProperty({ type: [String], example: ['test-uuid-1', 'test-uuid-2'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  @Type(() => String)
  testIds: string[];

  @ApiPropertyOptional({
    description: 'true = nahradí existující přiřazení',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  replaceAll?: boolean;
}
