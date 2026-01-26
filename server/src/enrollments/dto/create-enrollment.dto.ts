import { IsOptional, IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @IsOptional()
  @IsUUID()
  classroomId?: string;
}
