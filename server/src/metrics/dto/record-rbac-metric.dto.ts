import { PermissionKey } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class RecordRbacMetricDto {
  @IsString()
  route!: string;

  @IsOptional()
  @IsString()
  userId?: string | null;

  @IsOptional()
  @IsEnum(PermissionKey)
  permissionKey?: PermissionKey;

  @IsOptional()
  @IsString()
  message?: string;
}
