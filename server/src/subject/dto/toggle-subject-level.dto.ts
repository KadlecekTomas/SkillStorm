import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleSubjectLevelDto {
  @ApiProperty({ description: 'true = enable grade level, false = disable' })
  @IsBoolean()
  isEnabled!: boolean;
}
