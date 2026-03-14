import {
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  IsOptional,
  IsBoolean,
  IsString,
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
}
