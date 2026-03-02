import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetActiveSubjectDto {
  @ApiProperty({ description: 'true = activate, false = deactivate' })
  @IsBoolean()
  isActive!: boolean;
}
