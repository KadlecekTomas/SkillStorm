import { IsArray, IsOptional } from 'class-validator';

export class UpdateSubmissionDto {
  @IsArray()
  @IsOptional()
  responses?: Array<{
    questionId: string;
    givenText: string;
  }>;
}
