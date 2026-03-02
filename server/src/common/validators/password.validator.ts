import { registerDecorator, type ValidationOptions } from 'class-validator';

export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters long and contain at least one number.';

/**
 * Returns true when the password satisfies the global policy:
 *   - at least 8 characters
 *   - at least one digit
 */
export function validatePasswordStrength(password: string): boolean {
  if (typeof password !== 'string') return false;
  return password.length >= 8 && /\d/.test(password);
}

/**
 * class-validator decorator that enforces the global password policy.
 * Replaces ad-hoc @MinLength + @Matches combinations across DTOs.
 */
export function StrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'StrongPassword',
      target: object.constructor,
      propertyName,
      options: { message: PASSWORD_POLICY_MESSAGE, ...validationOptions },
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && validatePasswordStrength(value);
        },
        defaultMessage(): string {
          return PASSWORD_POLICY_MESSAGE;
        },
      },
    });
  };
}
