import { IsUUID } from 'class-validator';

export class QueryEnrollmentsDto {
  @IsUUID()
  classSectionId!: string;
}
