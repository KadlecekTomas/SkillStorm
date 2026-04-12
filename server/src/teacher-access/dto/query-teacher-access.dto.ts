import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class QueryTeacherAccessDto {
  @ApiPropertyOptional({ example: 'teacher-uuid' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;
}
