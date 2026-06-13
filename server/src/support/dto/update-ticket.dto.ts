import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { SupportTicketPriority, SupportTicketStatus } from '@prisma/client';

export class UpdateTicketDto {
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Assign ticket to a platform operator. Use null to clear assignment.',
  })
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? null : value))
  @IsUUID()
  assignedToId?: string | null;

  @ApiPropertyOptional({ enum: SupportTicketStatus })
  @IsOptional()
  @IsIn(Object.values(SupportTicketStatus))
  status?: SupportTicketStatus;

  @ApiPropertyOptional({ enum: SupportTicketPriority })
  @IsOptional()
  @IsIn(Object.values(SupportTicketPriority))
  priority?: SupportTicketPriority;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === '' ? null : value?.trim?.(),
  )
  @IsString()
  @MaxLength(2000)
  internalNote?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === '' ? null : value?.trim?.(),
  )
  @IsString()
  @Length(3, 2000)
  resolutionNote?: string | null;
}
