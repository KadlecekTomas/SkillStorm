// src/common/cache/user-scoped-cache.interceptor.ts
import { CacheInterceptor } from '@nestjs/cache-manager';
import type { ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { NO_HTTP_CACHE } from './no-http-cache.decorator';

@Injectable()
export class UserScopedCacheInterceptor extends CacheInterceptor {
  protected override trackBy(context: ExecutionContext): string | undefined {
    // Respect @NoHttpCache() decorator — skip caching entirely for this handler/class.
    const noCache =
      this.reflector?.get<boolean>(NO_HTTP_CACHE, context.getHandler()) ??
      this.reflector?.get<boolean>(NO_HTTP_CACHE, context.getClass());
    if (noCache) return undefined;

    const req = context.switchToHttp().getRequest<Request>();
    if (!req) return super.trackBy(context);

    // 1) Nikdy necachovat detail uživatele -> řeší "Before/After" bez dalších zásahů
    if (req.method === 'GET') {
      const url = (req.originalUrl || req.url || '').toLowerCase();
      // přesné ID (UUID včetně případného query stringu)
      if (
        /^\/users\/[0-9a-f-]{8}-[0-9a-f-]{4}-[1-5][0-9a-f-]{3}-[89ab][0-9a-f-]{3}-[0-9a-f-]{12}(?:\?.*)?$/.test(
          url,
        )
      ) {
        return undefined; // -> žádné HTTP cachování pro GET /users/:id
      }
    }

    // 2) Pro ostatní nech chování jako dřív (baseKey od parenta určuje cachovatelnost, tzn. jen GET/HEAD)
    const baseKey = super.trackBy(context);
    if (!baseKey) return undefined;

    const user: any = (req as any).user;
    const userId = user?.userId ?? user?.sub ?? 'anon';
    const orgId = user?.organizationId ?? 'no-org';
    return `${baseKey}::u=${userId}::org=${orgId}`;
  }
}
