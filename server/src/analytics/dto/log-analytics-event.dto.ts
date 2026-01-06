import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class LogAnalyticsEventDto {
  @IsString()
  @MaxLength(100)
  category!: string;

  @IsString()
  @MaxLength(100)
  action!: string;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string | null;

  @IsOptional()
  @IsNumber()
  value?: number | null;
}
