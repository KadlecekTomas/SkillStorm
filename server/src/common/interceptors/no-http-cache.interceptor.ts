// src/common/interceptors/no-http-cache.interceptor.ts
import { CacheInterceptor } from '@nestjs/cache-manager';
import type { ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { applyNoStoreHeaders } from '@/common/http/no-store-headers';

@Injectable()
export class NoHttpCacheInterceptor extends CacheInterceptor {
  protected override trackBy(context: ExecutionContext): string | undefined {
    const http = context.switchToHttp();
    applyNoStoreHeaders(http.getResponse(), http.getRequest<Request>());
    return undefined; // => žádná cache pro tyhle route
  }
}
