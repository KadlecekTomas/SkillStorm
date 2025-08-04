import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSchoolDto {
  @ApiProperty({ example: 'Základní škola Nová', description: 'Název školy' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Nová 123',
    description: 'Adresa školy',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    example: 'Praha',
    description: 'Město školy',
    required: false,
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({
    example: 'Česká republika',
    description: 'Země školy',
    required: false,
  })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ example: 'uuid-uzivatele', description: 'ID ředitele školy' })
  @IsUUID()
  @IsNotEmpty()
  directorId: string;
}
