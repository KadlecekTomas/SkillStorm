import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PasswordChangeRequiredGuard } from './guards/password-change-required.guard';
import { generateTemporaryPassword } from './temporary-password.util';
import { validatePasswordStrength } from '@/common/validators/password.validator';

function contextWithUser(mustChangePassword?: boolean): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { mustChangePassword } }),
    }),
    getHandler: () => contextWithUser,
    getClass: () => PasswordChangeRequiredGuard,
  } as unknown as ExecutionContext;
}

describe('first-login security primitives', () => {
  it('generates unique, policy-compliant temporary credentials', () => {
    const generated = Array.from({ length: 1_000 }, () =>
      generateTemporaryPassword(),
    );

    expect(new Set(generated).size).toBe(generated.length);
    generated.forEach((password) => {
      expect(validatePasswordStrength(password)).toBe(true);
      expect(password).toMatch(/^T9!/);
      expect(password.length).toBeGreaterThanOrEqual(32);
    });
  });

  it('blocks a marked account unless the endpoint is explicitly allowed', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new PasswordChangeRequiredGuard(reflector);

    expect(() => guard.canActivate(contextWithUser(true))).toThrow(
      ForbiddenException,
    );
  });

  it('allows the dedicated lifecycle endpoint and unaffected accounts', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new PasswordChangeRequiredGuard(reflector);

    expect(guard.canActivate(contextWithUser(true))).toBe(true);
    expect(guard.canActivate(contextWithUser(false))).toBe(true);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(true);
  });
});
