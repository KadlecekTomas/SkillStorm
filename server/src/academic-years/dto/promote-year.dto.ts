import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class PromoteYearDto {
  @ApiProperty({ description: 'ID of the target (next) academic year' })
  @IsUUID()
  toYearId!: string;
}
