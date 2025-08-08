import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length } from 'class-validator';

export class CreateCatalogTopicDto {
  @ApiProperty({ example: 'catalog-subject-id-uuid' })
  @IsUUID()
  subjectId: string;

  @ApiProperty({ example: 'Zlomky' })
  @IsString()
  @Length(2, 255)
  name: string;
}
