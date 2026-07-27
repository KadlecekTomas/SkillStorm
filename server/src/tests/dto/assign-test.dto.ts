import { GuardianLaunchPolicy } from '@prisma/client';
import {
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  IsOptional,
  IsBoolean,
  IsString,
  IsEnum,
} from 'class-validator';

export class AssignTestDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsUUID()
  classSectionId!: string;

  @IsOptional()
  @IsUUID()
  topicLevelId?: string;

  @IsDateString()
  openAt!: string;

  @IsDateString()
  closeAt!: string;

  @IsInt()
  @Min(1)
  maxAttempts!: number;

  @IsOptional()
  @IsInt()
  timeLimitSec?: number;

  @IsBoolean()
  shuffle!: boolean;

  @IsString()
  showExplain!: string;

  /** Guardian Etapa C: rodičovské spuštění (default DISABLED — princip 4). */
  @IsOptional()
  @IsEnum(GuardianLaunchPolicy)
  guardianLaunchPolicy?: GuardianLaunchPolicy;
}
