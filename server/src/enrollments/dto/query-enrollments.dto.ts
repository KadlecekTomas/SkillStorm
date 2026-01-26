import { IsOptional, IsUUID } from 'class-validator';

export class QueryEnrollmentsDto {
  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @IsOptional()
  @IsUUID()
  classroomId?: string;
}
