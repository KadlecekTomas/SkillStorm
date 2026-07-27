import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID, Matches } from 'class-validator';

export class StartLearningSessionDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;

  /** V1 je relace vždy vázaná na konkrétní zadání (STOP #3 rozhodnutí 3). */
  @ApiProperty()
  @IsUUID()
  assignmentId!: string;

  /** Deklarace rodiče „pomáhal jsem" — jde do provenance odevzdání. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  assistanceDeclared?: boolean;

  /** PIN dítěte, pokud ho policy zadání vyžaduje. Nikdy se neloguje. */
  @ApiPropertyOptional({ pattern: '^\\d{4,6}$' })
  @IsOptional()
  @Matches(/^\d{4,6}$/, { message: 'PIN_FORMAT_INVALID' })
  pin?: string;
}
