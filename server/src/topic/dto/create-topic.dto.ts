import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Difficulty, TopicPhase } from '@prisma/client';

export class CreateTopicDto {
  @ApiProperty({ example: 'Zlomky' })
  @IsOptional() // name je v modelu optional (může se brát z katalogu)
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'subject-level-id-uuid',
    description: 'ID SubjectLevel (předmět × ročník)',
  })
  @IsUUID()
  subjectLevelId!: string;

  @ApiProperty({
    example: 'catalog-topic-id-uuid',
    description: 'ID CatalogTopic (globální katalog)',
  })
  @IsUUID()
  catalogTopicId!: string;

  @ApiPropertyOptional({ enum: TopicPhase, example: TopicPhase.INTRO })
  @IsOptional()
  @IsEnum(TopicPhase)
  phase?: TopicPhase;

  @ApiPropertyOptional({ enum: Difficulty, example: Difficulty.BASIC })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
