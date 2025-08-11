import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
export class UpdateAnswerDto {
  @ApiPropertyOptional() @IsOptional() @IsString() text?: string;
}
