import { IsOptional, IsUUID } from 'class-validator';

export class QueryEnrollmentsDto {
  @IsUUID()
  academicYearId!: string;

  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @IsOptional()
  @IsUUID()
  classroomId?: string;
}
