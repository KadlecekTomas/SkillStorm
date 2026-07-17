import { IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitEpilogueDto {
  /** Vzkaz budoucí třídě — píše učitel po dokončení Mise. */
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message!: string;
}
