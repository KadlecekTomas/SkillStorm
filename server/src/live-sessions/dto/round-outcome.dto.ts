import { LiveRoundOutcome } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class RoundOutcomeDto {
  @IsEnum(LiveRoundOutcome)
  outcome!: LiveRoundOutcome;
}
