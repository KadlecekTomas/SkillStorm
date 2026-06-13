import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { QuestionType } from '@prisma/client';

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeList(values: unknown): string[] | null {
  if (!Array.isArray(values)) return null;
  return values
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
}

@ValidatorConstraint({ name: 'QuestionAnswersValidator', async: false })
export class QuestionAnswersValidator implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const obj = args.object as {
      type?: QuestionType;
      correctAnswer?: string | null;
      correctAnswers?: string[] | null;
    };

    const hasAnswer = hasText(obj.correctAnswer ?? undefined);
    const normalizedAnswers = normalizeList(obj.correctAnswers ?? undefined);
    const hasAnswers =
      Array.isArray(normalizedAnswers) && normalizedAnswers.length > 0;

    if (hasAnswer && hasAnswers) return false;

    if (
      obj.type === QuestionType.TRUE_FALSE ||
      obj.type === QuestionType.FILL_IN_THE_BLANK
    ) {
      if (obj.correctAnswers && obj.correctAnswers.length > 0) return false;
      if (obj.correctAnswer !== undefined && !hasAnswer) return false;
    }

    if (obj.type === QuestionType.MULTIPLE_CHOICE) {
      if (obj.correctAnswers !== undefined && !hasAnswers) return false;
      if (obj.correctAnswer !== undefined && !hasAnswer) return false;
    }

    if (hasAnswers) {
      const unique = new Set(normalizedAnswers);
      if (unique.size !== normalizedAnswers.length) return false;
    }

    return true;
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'Invalid correctAnswer/correctAnswers combination for question type';
  }
}
