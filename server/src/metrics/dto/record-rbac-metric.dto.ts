import { PermissionKey } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordRbacMetricDto {
  @IsString()
  @MaxLength(256)
  route!: string;

  @IsOptional()
  @IsString()
  userId?: string | null;

  @IsOptional()
  @IsEnum(PermissionKey)
  permissionKey?: PermissionKey;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  message?: string;
}
