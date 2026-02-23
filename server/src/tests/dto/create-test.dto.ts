// src/tests/dto/create-test.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { PublishStatus } from '@prisma/client';

export class CreateTestDto {
  @ApiProperty({ example: 'Písemka – Zlomky' })
  @IsString()
  @Length(3, 255)
  title!: string;

  @ApiPropertyOptional({ example: 'Krátká prověrka na zlomky' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Cílová organizace', example: 'uuid' })
  @IsUUID()
  organizationId!: string;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.DRAFT })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @ApiPropertyOptional({ description: 'Org subject UUID (validated against organization)' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;
}
