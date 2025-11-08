import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { XpEventType } from '@prisma/client';

export class AddXpEventDto {
  @IsString()
  membershipId!: string;

  @IsEnum(XpEventType)
  type!: XpEventType;

  @IsInt()
  @Min(1)
  value!: number;

  @IsOptional()
  @IsString()
  description?: string;
}
