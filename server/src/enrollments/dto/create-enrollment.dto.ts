import { IsOptional, IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  yearId?: string;

  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @IsOptional()
  @IsUUID()
  classroomId?: string;
}
