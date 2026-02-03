import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';

describe('PlatformAdminGuard', () => {
  const guard = new PlatformAdminGuard();

  const createContext = (user: { isPlatformAdmin?: boolean } | null): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as ExecutionContext;
  };

  it('allows when user.isPlatformAdmin is true', () => {
    const ctx = createContext({ isPlatformAdmin: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws 403 when user.isPlatformAdmin is false', () => {
    const ctx = createContext({ isPlatformAdmin: false });
    let err: unknown;
    try {
      guard.canActivate(ctx);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({
      code: 'FORBIDDEN_PLATFORM_ADMIN_ONLY',
    });
  });

  it('throws 403 when user is null', () => {
    const ctx = createContext(null);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
