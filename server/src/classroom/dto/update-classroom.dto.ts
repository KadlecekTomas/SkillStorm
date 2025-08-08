import { PartialType } from '@nestjs/swagger';
import { CreateClassSectionDto } from './create-classroom.dto';

export class UpdateClassroomDto extends PartialType(CreateClassSectionDto) {}
