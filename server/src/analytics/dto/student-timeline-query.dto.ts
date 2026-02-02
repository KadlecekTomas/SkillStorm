import { IsOptional, IsUUID } from 'class-validator';

export class StudentTimelineQueryDto {
  @IsUUID()
  yearId!: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;
}
