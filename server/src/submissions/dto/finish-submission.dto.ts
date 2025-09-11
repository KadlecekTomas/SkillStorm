import { IsOptional, IsArray } from 'class-validator';

export class FinishSubmissionDto {
  @IsOptional()
  @IsArray()
  responses?: Array<{
    questionId: string;
    givenText: string;
  }>;
}
