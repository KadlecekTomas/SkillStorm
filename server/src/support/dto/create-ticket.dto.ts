import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsObject, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ example: 'Test' })
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => value?.trim())
  category!: string;

  @ApiProperty({ example: 'Při ukládání testu se zobrazuje chyba validace.' })
  @IsString()
  @Length(10, 4000)
  @Transform(({ value }) => value?.trim())
  message!: string;

  @ApiPropertyOptional({ example: '/app/tests/123' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  page?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
