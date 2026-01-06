import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssignSubjectsDto {
  @ApiProperty({
    type: [String],
    example: ['subject-uuid-1', 'subject-uuid-2'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  @Type(() => String)
  subjectIds!: string[];

  @ApiPropertyOptional({
    description:
      'Pokud true: nahradí existující přiřazení (tj. odstraní ostatní). Pokud false/nezadáno: pouze přidá chybějící.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  replaceAll?: boolean;
}
