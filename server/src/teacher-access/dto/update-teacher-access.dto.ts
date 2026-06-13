import { PartialType } from '@nestjs/swagger';
import { CreateTeacherAccessDto } from './create-teacher-access.dto';

export class UpdateTeacherAccessDto extends PartialType(
  CreateTeacherAccessDto,
) {}
