import { PartialType } from '@nestjs/swagger';
import { CreateCatalogSubjectDto } from './create-catalog-subject.dto';

export class UpdateCatalogSubjectDto extends PartialType(
  CreateCatalogSubjectDto,
) {}
