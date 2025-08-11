// src/common/cache/smart-cache.interceptor.ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NO_HTTP_CACHE } from './no-http-cache.decorator';

@Injectable()
export class SmartCacheInterceptor extends CacheInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) cacheManager: Cache,
    reflector: Reflector,
  ) {
    // předáme reflector do rodiče; ten si ho uloží (protected this.reflector)
    super(cacheManager, reflector);
  }

  protected override isRequestCacheable(context: ExecutionContext): boolean {
    const skip =
      this.reflector?.get<boolean>(NO_HTTP_CACHE, context.getHandler()) ??
      this.reflector?.get<boolean>(NO_HTTP_CACHE, context.getClass());
    if (skip) return false;
    return super.isRequestCacheable(context);
  }

  // volitelné: navíc chrání i případný trackBy (když bys měl custom key)
  protected override trackBy(context: ExecutionContext): string | undefined {
    const skip =
      this.reflector?.get<boolean>(NO_HTTP_CACHE, context.getHandler()) ??
      this.reflector?.get<boolean>(NO_HTTP_CACHE, context.getClass());
    if (skip) return undefined;
    return super.trackBy(context);
  }
}
