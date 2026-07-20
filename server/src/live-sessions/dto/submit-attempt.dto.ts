import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const ATTEMPT_KINDS = ['PLACE', 'CHECK'] as const;
export type AttemptKind = (typeof ATTEMPT_KINDS)[number];

/**
 * Jeden tah na tabuli v interaktivním kole.
 * PLACE (MATCH_PAIRS, SORT_BINS): položení kartičky itemId na cíl targetId.
 * CHECK (ORDER): stisk Zkontrolovat s aktuálním rozložením řady.
 * Server soudí každý tah — řešení nikdy neopouští server před dokončením.
 */
export class SubmitAttemptDto {
  @ApiProperty({ enum: ATTEMPT_KINDS })
  @IsIn(ATTEMPT_KINDS)
  kind!: AttemptKind;

  @ApiPropertyOptional({
    description: 'PLACE: round-local ID kartičky (l1/c1…)',
  })
  @ValidateIf((o) => o.kind === 'PLACE')
  @IsString()
  @MaxLength(16)
  itemId?: string;

  @ApiPropertyOptional({ description: 'PLACE: round-local ID cíle (r1/b1…)' })
  @ValidateIf((o) => o.kind === 'PLACE')
  @IsString()
  @MaxLength(16)
  targetId?: string;

  @ApiPropertyOptional({
    description: 'CHECK: aktuální pořadí řady (round-local ID zleva doprava)',
  })
  @ValidateIf((o) => o.kind === 'CHECK')
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(16, { each: true })
  arrangement?: string[];
}
