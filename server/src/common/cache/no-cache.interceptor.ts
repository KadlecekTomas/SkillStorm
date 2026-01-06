// src/common/cache/no-cache.interceptor.ts
import { CacheInterceptor } from '@nestjs/cache-manager';
import type { ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';

@Injectable()
export class NoCacheInterceptor extends CacheInterceptor {
  // vrácení undefined = žádné cachování pro tento handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected trackBy(_context: ExecutionContext): string | undefined {
    return undefined;
  }
}
