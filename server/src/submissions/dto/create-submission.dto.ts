import { IsUUID } from 'class-validator';

export class CreateSubmissionDto {
  @IsUUID()
  assignmentId: string;
}
