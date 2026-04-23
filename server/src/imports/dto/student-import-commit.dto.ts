import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class StudentImportCommitRowDto {
  @ApiProperty({ example: 'Jan' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Novak' })
  @IsString()
  lastName!: string;

  @ApiPropertyOptional({ example: 'jan.novak@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '5.A' })
  @IsString()
  class!: string;
}

export class StudentImportCommitDto {
  @ApiProperty({ type: [StudentImportCommitRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentImportCommitRowDto)
  rows!: StudentImportCommitRowDto[];

  @ApiPropertyOptional({ example: 'students.csv' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ example: 'class-section-uuid' })
  @IsOptional()
  @IsUUID()
  defaultClassSectionId?: string;
}
