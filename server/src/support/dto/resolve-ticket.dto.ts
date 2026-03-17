import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ResolveTicketDto {
  @ApiProperty({ enum: ['RESOLVED'], example: 'RESOLVED' })
  @IsIn(['RESOLVED'])
  status!: 'RESOLVED';
}
