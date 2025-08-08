import { PartialType } from '@nestjs/swagger';
import { CreateCatalogTopicDto } from './create-catalog-topic.dto';

export class UpdateCatalogTopicDto extends PartialType(CreateCatalogTopicDto) {}
