// src/tests/dto/create-option.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
export class CreateOptionDto {
  @ApiProperty() @IsString() text!: string;
}
