import { validateEnvironment, buildCorsOrigin } from './bootstrap.utils';
import { NestFactory } from '@nestjs/core';
import type {
  ArgumentsHost,
  ExceptionFilter,
  INestApplication,
  NestApplicationOptions,
} from '@nestjs/common';
import {
  Catch,
  HttpException,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { setupSwagger } from './swagger.config';
import { CSRF_TOKEN_COOKIE } from './auth/token-cookies';
import { randomUUID } from 'crypto';

/** Request with correlation id set by middleware */
type RequestWithId = { requestId?: string; headers: any; [k: string]: any };

/**
 * Jednotný exception filter:
 * - HttpException vrací, jak je
 * - ZodError → 400
 * - PrismaKnownError → 400/404/409 podle kódu
 * - fallback → 500
 */
@Catch()
class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest<RequestWithId>();
    const requestId = req?.requestId ?? null;

    if (process.env.DEBUG_POLICY === '1') {
      // eslint-disable-next-line no-console
      console.error('[AllExceptionsFilter]', requestId ? { requestId } : {}, exception);
      if (exception?.stack) {
        // eslint-disable-next-line no-console
        console.error(exception.stack);
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        return res.status(status).json({ success: false, error: body });
      }
      const message = (body as any)?.message ?? body;
      const meta =
        (body as any)?.meta ??
        ((body as any)?.code ? { code: (body as any).code } : undefined);
      return res.status(status).json({
        success: false,
        error: message,
        ...(meta ? { meta } : {}),
      });
    }

    if (exception instanceof ZodError) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: 'Validation failed',
        meta: { issues: exception.issues },
      });
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': // unique violation
          return res.status(HttpStatus.CONFLICT).json({
            success: false,
            error: 'Unique constraint failed',
            meta: exception.meta,
          });
        case 'P2003': // foreign key
          return res.status(HttpStatus.BAD_REQUEST).json({
            success: false,
            error: 'Foreign key constraint failed',
            meta: exception.meta,
          });
        case 'P2025': // not found
          return res.status(HttpStatus.NOT_FOUND).json({
            success: false,
            error: 'Record not found',
            meta: exception.meta,
          });
      }
    }

    // Log 5xx with requestId for correlation
    if (requestId) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({
        event: 'server_error',
        requestId,
        error: String(exception?.message ?? exception),
      }));
    }
    // Optional Sentry (only if SENTRY_DSN set and @sentry/node available)
    if (process.env.SENTRY_DSN) {
      try {
        const Sentry = require('@sentry/node');
        Sentry.captureException(exception);
      } catch {
        // Sentry not installed or init failed
      }
    }
    // In production do not leak exception message to client
    const isProduction = process.env.NODE_ENV === 'production';
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Internal Server Error',
      ...(isProduction ? {} : { meta: String(exception?.message ?? exception) }),
    });
  }
}

/**
 * Společná factory – používej ji v prod (main) i v e2e testech.
 */
export async function createApp(): Promise<INestApplication> {
  const isTest = process.env.NODE_ENV === 'test';
  const enableTestLogging = process.env.DEBUG_POLICY === '1';
  const options: NestApplicationOptions = {};
  if (isTest && !enableTestLogging) {
    options.logger = false;
  }
  const app = await NestFactory.create(AppModule, options);
  app.getHttpAdapter().getInstance().set('etag', false);
  app.use(cookieParser());

  // Request correlation id (generate if missing; log on errors)
  app.use((req: RequestWithId, res: any, next: any) => {
    const id = (req.headers['x-request-id'] as string)?.trim() || randomUUID();
    req.requestId = id;
    res.setHeader('x-request-id', id);
    next();
  });

  app.enableCors({
    origin: buildCorsOrigin(
      process.env.CORS_ORIGINS,
      process.env.NODE_ENV === 'production',
    ),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'x-org-id',
      'x-csrf-token',
      'x-cid',
      'x-metrics-key',
      'x-e2e-token',
      'x-request-id',
    ],
  });

  // CSRF double-submit protection for state-changing requests
  if (process.env.DISABLE_CSRF !== '1') {
    app.use((req: any, res: any, next: any) => {
      const method = req.method?.toUpperCase?.() ?? '';
      const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
        method,
      );
      const isAuthBootstrap = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/use-org'].some(
        (path) => req.path?.startsWith(path),
      );
      if (!isStateChanging || isAuthBootstrap) {
        return next();
      }
      const csrfCookie = req.cookies?.[CSRF_TOKEN_COOKIE];
      const csrfHeader =
        (req.headers?.['x-csrf-token'] as string | undefined) ?? null;
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return res.status(403).json({
          success: false,
          error: 'CSRF token mismatch',
        });
      }
      return next();
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  return app;
}

/**
 * Production-only check: ensure a SUPERADMIN exists or bootstrap credentials are supplied.
 */
async function runProductionEnvCheck(app: INestApplication): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return;
  const prisma = app.get(PrismaService);
  const { SystemRole } = await import('@prisma/client');
  const existing = await prisma.user.findFirst({
    where: { systemRole: SystemRole.SUPERADMIN },
    select: { id: true },
  });
  if (!existing) {
    if (!process.env.SUPERADMIN_EMAIL?.trim() || !process.env.SUPERADMIN_PASSWORD) {
      throw new Error(
        'No SUPERADMIN exists. Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD for initial bootstrap.',
      );
    }
  }
}

/**
 * Optional Sentry init when SENTRY_DSN is set. No-op if @sentry/node not installed.
 */
function initSentryIfConfigured(): void {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN });
  } catch {
    // @sentry/node not installed
  }
}

function isSwaggerEnabled(): boolean {
  const explicit = process.env.ENABLE_SWAGGER?.trim().toLowerCase();
  if (explicit) {
    return explicit === '1' || explicit === 'true' || explicit === 'yes';
  }

  return process.env.NODE_ENV !== 'production';
}

/**
 * Produkční/dev bootstrap (spouští HTTP server).
 * V test módu se server nespouští – v e2e si zavolej `createApp()` + `app.init()`.
 */
async function bootstrap() {
  validateEnvironment();
  initSentryIfConfigured();
  const app = await createApp();

  if (process.env.NODE_ENV === 'production') {
    await runProductionEnvCheck(app);
  }

  if (process.env.NODE_ENV !== 'test') {
    if (isSwaggerEnabled()) {
      setupSwagger(app);
    }
    await app.listen(process.env.PORT ?? 4200, '0.0.0.0');
  } else {
    // e2e: pouze inicializace bez otevření portu
    await app.init();
  }
}
bootstrap();
