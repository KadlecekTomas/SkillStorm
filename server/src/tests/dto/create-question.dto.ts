// src/tests/dto/create-question.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  Validate,
  ValidateIf,
} from 'class-validator';
import { QuestionType } from '@prisma/client';
import { QuestionAnswersValidator } from './question-answers.validator';

export class CreateQuestionDto {
  @ApiProperty() @IsString() text!: string;
  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  type!: QuestionType;
  @ApiPropertyOptional({ example: 1 })
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
    example: 'true',
    description:
      'Single correct answer (TRUE_FALSE, FILL_IN_THE_BLANK, or single-choice MCQ)',
  })
  @ValidateIf((o) => o.correctAnswer !== undefined)
  @IsString()
  @MinLength(1)
  correctAnswer?: string;

  @ApiPropertyOptional({
    example: ['A', 'C'],
    description: 'Multiple correct answers (MULTIPLE_CHOICE only)',
  })
  @ValidateIf((o) => o.correctAnswers !== undefined)
  @IsArray()
  @IsString({ each: true })
  correctAnswers?: string[];

  @Validate(QuestionAnswersValidator)
  private readonly _answersValidation?: never;
}
