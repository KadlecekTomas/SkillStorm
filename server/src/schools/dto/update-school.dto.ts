import { IsOptional, IsUUID } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { CreateSchoolDto } from './create-school.dto';

export class UpdateSchoolDto extends PartialType(CreateSchoolDto) {
  @IsUUID()
  @IsOptional()
  directorId?: string;
}
