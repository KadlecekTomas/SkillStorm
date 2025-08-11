import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export enum OverviewScope {
  EVALUATED = 'evaluated',
  ALL = 'all',
}

/**
 * Query DTO pro /stats/overview
 * Sanitizace: cokoliv mimo "all" => "evaluated".
 * Nepoužíváme IsEnum, aby ?scope=blabla nevrátilo 400.
 */
export class StatsOverviewQueryDto {
  @ApiPropertyOptional({
    enum: OverviewScope,
    default: OverviewScope.EVALUATED,
    description:
      'Jak počítat passRate. "evaluated" = APPROVED/(APPROVED+REJECTED). "all" = APPROVED/ALL (vč. PENDING).',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    const v = String(value ?? '')
      .trim()
      .toLowerCase();
    return v === OverviewScope.ALL
      ? OverviewScope.ALL
      : OverviewScope.EVALUATED;
  })
  scope?: OverviewScope = OverviewScope.EVALUATED;
}
