import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, concatMap } from 'rxjs';
import { AuditEntityType, Prisma } from '@prisma/client';
import { AuditService } from '@/audit/audit.service';
import type { RequestWithUser } from '@/types/request-with-user';

/**
 * Interceptor that writes an audit log entry after every successful platform
 * MUTATION endpoint and before the response is completed.
 *
 * Apply only on @RequirePlatformAccess(MUTATION) handlers — never globally.
 * Audit failures are fail-closed: the client must not receive a successful
 * mutation response when its required audit evidence could not be persisted.
 * Service-level critical mutations should still prefer same-transaction audit
 * when their business transaction can expose a Prisma TransactionClient.
 *
 * Audit format:
 *   action:         PLATFORM_MUTATION:<HANDLER_NAME>   e.g. PLATFORM_MUTATION:ACTIVATE
 *   entityType:     ORGANIZATION
 *   entityId:       req.params.id
 *   organizationId: req.params.id (same — platform mutations are always on orgs)
 *   userId:         caller's userId
 *   ipAddress:      caller's IP
 *   metadata:       { params, body } — canonical AuditService transforms body
 *                   into a key-only summary and recursively removes secrets.
 */
@Injectable()
export class PlatformMutationAuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const handlerName = context.getHandler().name.toUpperCase();
    const entityId: string | null =
      (req.params as Record<string, string>)?.id ?? null;

    return next.handle().pipe(
      concatMap(async (value) => {
        await this.auditService.log({
          action: `PLATFORM_MUTATION:${handlerName}`,
          entityType: AuditEntityType.ORGANIZATION,
          entityId,
          organizationId: entityId,
          userId: req.user?.userId ?? null,
          systemRole: (req.user?.systemRole as string | undefined) ?? null,
          ipAddress: req.ip ?? null,
          userAgent: req.headers?.['user-agent'] ?? null,
          metadata: toJsonSafe({
            params: req.params as Record<string, string>,
            body: req.body as Record<string, unknown>,
          }),
        });
        return value;
      }),
    );
  }
}

function toJsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
