import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class AcceptInviteDto {
  @ApiPropertyOptional({ description: 'Invite token (preferred field)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  inviteToken?: string;

  @ApiPropertyOptional({ description: 'Invite code (from link or manual entry)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  code?: string;

  @ApiPropertyOptional({ description: 'Invite token (preferred; same as code from invite link)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  token?: string;
}
