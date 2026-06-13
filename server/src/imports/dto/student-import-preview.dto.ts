import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class StudentImportPreviewDto {
  @ApiProperty({
    example:
      'firstName,lastName,email,class\nJan,Novak,jan.novak@example.com,5.A',
  })
  @IsString()
  csv!: string;

  @ApiPropertyOptional({ example: 'students.csv' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ example: 'class-section-uuid' })
  @IsOptional()
  @IsUUID()
  defaultClassSectionId?: string;
}
