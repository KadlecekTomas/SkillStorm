import { LiveAgeMode } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateLiveSessionDto {
  @IsUUID()
  testId!: string;

  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  /** Ruční override věkového režimu (smíšené skupiny, semináře). */
  @IsOptional()
  @IsEnum(LiveAgeMode)
  ageMode?: LiveAgeMode;

  /** Odpočet na kolo v sekundách; nezadáno = bez odpočtu. */
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  countdownSec?: number;

  /**
   * Volitelná vazba na kampaň (Výprava/Mise). Vyžaduje classSectionId
   * shodný s třídou kampaně; bleskovka bez kampaně funguje beze změny.
   */
  @IsOptional()
  @IsUUID()
  campaignProgressId?: string;
}
