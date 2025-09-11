// src/common/interceptors/no-http-cache.interceptor.ts
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class NoHttpCacheInterceptor extends CacheInterceptor {
  protected trackBy(): string | undefined {
    return undefined; // => žádná cache pro tyhle route
  }
}
