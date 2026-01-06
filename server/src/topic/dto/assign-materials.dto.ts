import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssignMaterialsDto {
  @ApiProperty({
    type: [String],
    example: ['material-uuid-1', 'material-uuid-2'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  @Type(() => String)
  materialIds!: string[];

  @ApiPropertyOptional({
    description: 'true = nahradí existující přiřazení',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  replaceAll?: boolean;
}
