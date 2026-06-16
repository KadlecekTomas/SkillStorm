import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const FOCUS_EVENT_TYPES = [
  'window_blur',
  'window_focus',
  'visibility_hidden',
  'visibility_visible',
  'offline',
  'online',
] as const;

export type FocusEventType = (typeof FOCUS_EVENT_TYPES)[number];

export class FocusEventItemDto {
  @IsIn(FOCUS_EVENT_TYPES)
  type!: FocusEventType;

  /** Client wall-clock epoch ms when the event occurred (advisory; the server stamps createdAt). */
  @IsInt()
  clientTimestamp!: number;

  /** Aggregated count when the client deduplicated repeats of the same event type. */
  @IsOptional()
  @IsInt()
  @Min(1)
  count?: number;
}

export class FocusEventsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FocusEventItemDto)
  events!: FocusEventItemDto[];
}
