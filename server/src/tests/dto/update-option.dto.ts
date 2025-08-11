import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
export class UpdateOptionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() text?: string;
}
