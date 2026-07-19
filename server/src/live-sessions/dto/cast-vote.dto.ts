import { IsIn, IsOptional } from 'class-validator';
import { OPTION_KEYS, OptionKey } from '../live-sessions.constants';

/** Jeden dotyk na tabuli: tap = +1, long-press = −1. Anonymní, bez osoby. */
export class CastVoteDto {
  @IsIn(OPTION_KEYS)
  key!: OptionKey;

  @IsOptional()
  @IsIn([1, -1])
  delta?: 1 | -1;
}
