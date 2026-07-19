import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  Validate,
  ValidateIf,
} from 'class-validator';
import { QuestionType } from '@prisma/client';
import { QuestionAnswersValidator } from './question-answers.validator';

export class UpdateQuestionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() text?: string;
  @ApiPropertyOptional({ enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  score?: number;

  @ApiPropertyOptional({
    example: 'false',
    description:
      'Single correct answer (TRUE_FALSE, FILL_IN_THE_BLANK, or single-choice MCQ)',
  })
  @ValidateIf((o) => o.correctAnswer !== undefined)
  @IsString()
  @MinLength(1)
  correctAnswer?: string;

  @ApiPropertyOptional({
    example: ['A', 'B'],
    description: 'Multiple correct answers (MULTIPLE_CHOICE only)',
  })
  @ValidateIf((o) => o.correctAnswers !== undefined)
  @IsArray()
  @IsString({ each: true })
  correctAnswers?: string[];

  @ApiPropertyOptional({
    description:
      'Autorská data interaktivních typů (MATCH_PAIRS/ORDER/SORT_BINS) — tvary viz shared/interactive-content.util.ts. Hloubková validace probíhá v service.',
  })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @Validate(QuestionAnswersValidator)
  private readonly _answersValidation?: never;
}
