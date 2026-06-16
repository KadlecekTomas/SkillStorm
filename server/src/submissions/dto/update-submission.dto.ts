import { IsArray, IsInt, IsOptional } from 'class-validator';

export class UpdateSubmissionDto {
  @IsArray()
  @IsOptional()
  responses?: Array<{
    questionId: string;
    givenText: string;
  }>;

  /**
   * Monotonic client-side autosave counter from the Focus Test Mode draft.
   * Accepted for forward-compatibility/telemetry only — the server does not persist it
   * and ordering is still resolved by the DB (responses are idempotent per questionId).
   */
  @IsInt()
  @IsOptional()
  clientVersion?: number;
}
