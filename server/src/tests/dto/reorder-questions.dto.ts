// src/tests/dto/reorder-questions.dto.ts
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

class ReorderItemDto {
  @IsUUID('4')
  id!: string;

  @IsInt()
  @Min(0)
  order!: number;
}

export class ReorderQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  @ArrayUnique((i: ReorderItemDto) => i.id)
  items!: ReorderItemDto[];
}
