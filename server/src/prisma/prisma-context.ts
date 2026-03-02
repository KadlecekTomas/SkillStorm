import { AsyncLocalStorage } from 'async_hooks';

/**
 * Prisma operation context propagated via AsyncLocalStorage.
 *
 * Middleware can read this context to grant narrowly-scoped privileges
 * without relying on global flags or environment variables.
 */
export interface PrismaContext {
  /**
   * Set to `true` only within `AuditRetentionService.anonymizeExpiredAuditLogs()`.
   *
   * When true, the immutability middleware permits a single `updateMany` on
   * `AuditLog` that sets `userId`, `ipAddress`, and `userAgent` to null.
   * All other writes remain blocked even with this flag set.
   */
  auditRetentionBypass?: boolean;
}

const storage = new AsyncLocalStorage<PrismaContext>();

/**
 * Read the current Prisma context for the running async call chain.
 * Returns an empty object when called outside a `runWithPrismaContext` scope.
 */
export function getPrismaContext(): PrismaContext {
  return storage.getStore() ?? {};
}

/**
 * Execute `fn` within a Prisma context.
 *
 * The context is scoped to the async call chain initiated by `fn` — it does
 * not leak to sibling or parent continuations.
 *
 * @example
 * await runWithPrismaContext({ auditRetentionBypass: true }, () =>
 *   prisma.auditLog.updateMany({ ... }),
 * );
 */
export async function runWithPrismaContext<T>(
  ctx: PrismaContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(ctx, fn);
}
