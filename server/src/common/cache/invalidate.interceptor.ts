import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { Injectable, Inject } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { from, of, switchMap } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import type { ScopeFactory } from './invalidate.decorator';
import { INVALIDATE_SCOPES } from './invalidate.decorator';
import { bumpMany } from './versioned-cache';

@Injectable()
export class InvalidateInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly reflector: Reflector,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const meta = this.reflector.get<string[] | ScopeFactory | undefined>(
      INVALIDATE_SCOPES,
      ctx.getHandler(),
    );
    if (!meta) return next.handle();

    const req = ctx.switchToHttp().getRequest();

    return next.handle().pipe(
      switchMap((result) => {
        const args = ctx.getArgs();
        const compute = async () =>
          Array.isArray(meta)
            ? meta
            : await (meta as ScopeFactory)({ req, result, args });

        return from(compute()).pipe(
          switchMap((scopes) => {
            if (!scopes?.length) return of(result);
            return from(bumpMany(this.cache, scopes)).pipe(
              switchMap(() => of(result)),
            );
          }),
        );
      }),
    );
  }
}
