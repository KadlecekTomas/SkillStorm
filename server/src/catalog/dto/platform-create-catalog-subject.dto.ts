import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class PlatformCreateCatalogSubjectDto {
  @ApiProperty({ example: 'MATH' })
  @IsString()
  @Length(2, 32)
  code!: string;

  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @Length(2, 255)
  name!: string;
}
