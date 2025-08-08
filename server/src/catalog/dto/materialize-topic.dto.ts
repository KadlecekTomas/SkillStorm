import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Difficulty, TopicPhase } from '@prisma/client';

export class MaterializeTopicDto {
  @ApiProperty({ example: 'subject-level-id-uuid' })
  @IsUUID()
  subjectLevelId: string;

  @ApiPropertyOptional({ enum: TopicPhase, example: TopicPhase.INTRO })
  @IsOptional()
  @IsEnum(TopicPhase)
  phase?: TopicPhase;

  @ApiPropertyOptional({ enum: Difficulty, example: Difficulty.BASIC })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
