import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { AttendanceStatus } from '../progress.types';

export class CreateAttendanceRecordDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  minutesLate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
