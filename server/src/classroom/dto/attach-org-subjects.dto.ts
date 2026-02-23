import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class AttachOrgSubjectsDto {
  @ApiProperty({
    type: [String],
    example: ['org-subject-uuid-1', 'org-subject-uuid-2'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orgSubjectIds!: string[];

  @ApiPropertyOptional({
    description:
      'Pokud true: nahradí existující přiřazení. Pokud false/nezadáno: pouze přidá chybějící.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  replaceAll?: boolean;
}
