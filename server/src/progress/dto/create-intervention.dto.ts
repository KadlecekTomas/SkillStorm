import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateInterventionDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsString()
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  note?: string;
}
