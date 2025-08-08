import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Difficulty, TopicPhase } from '@prisma/client';

export class MaterializeTopicsBulkDto {
  @ApiProperty({ example: 'catalog-subject-id-uuid' })
  @IsUUID()
  catalogSubjectId: string;

  @ApiProperty({ example: 'subject-level-id-uuid' })
  @IsUUID()
  subjectLevelId: string;

  @ApiProperty({
    type: [String],
    example: ['catalog-topic-id-1', 'catalog-topic-id-2'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  @Type(() => String)
  catalogTopicIds: string[];

  @ApiPropertyOptional({ enum: TopicPhase, example: TopicPhase.INTRO })
  @IsOptional()
  @IsEnum(TopicPhase)
  defaultPhase?: TopicPhase;

  @ApiPropertyOptional({ enum: Difficulty, example: Difficulty.BASIC })
  @IsOptional()
  @IsEnum(Difficulty)
  defaultDifficulty?: Difficulty;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  appendAfter?: number;
}
