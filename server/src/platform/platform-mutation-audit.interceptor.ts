import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditEntityType, Prisma } from '@prisma/client';
import { AuditService } from '@/audit/audit.service';
import type { RequestWithUser } from '@/types/request-with-user';

/**
 * Interceptor that automatically writes an audit log entry after every
 * platform MUTATION endpoint completes successfully.
 *
 * Apply only on @RequirePlatformAccess(MUTATION) handlers — never globally.
 * The audit entry is written after the response is sent (tap), so it does NOT
 * block the HTTP response even if the audit write is slow.
 *
 * Audit format:
 *   action:         PLATFORM_MUTATION:<HANDLER_NAME>   e.g. PLATFORM_MUTATION:ACTIVATE
 *   entityType:     ORGANIZATION
 *   entityId:       req.params.id
 *   organizationId: req.params.id (same — platform mutations are always on orgs)
 *   userId:         caller's userId
 *   ipAddress:      caller's IP
 *   metadata:       { params, body } — sanitized (no passwords, no tokens)
 */
@Injectable()
export class PlatformMutationAuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const handlerName = context.getHandler().name.toUpperCase();
    const entityId: string | null = (req.params as Record<string, string>)?.id ?? null;

    return next.handle().pipe(
      tap(() => {
        // Fire-and-forget: audit log must not block or fail the HTTP response.
        void this.auditService
          .log({
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
              // Exclude sensitive fields from body (tokens, passwords)
              body: sanitizeBody(req.body as Record<string, unknown>),
            }),
          })
          .catch((err: unknown) => {
            // Audit failure must never surface to the client
            console.error('[PlatformMutationAudit] Failed to write audit log:', err);
          });
      }),
    );
  }
}

function toJsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

const SENSITIVE_KEYS = new Set(['password', 'token', 'secret', 'authorization', 'cookie']);

function sanitizeBody(body: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => !SENSITIVE_KEYS.has(key.toLowerCase())),
  );
}
