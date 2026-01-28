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
import { bootstrapSearchAll } from './db/bootstrap-search-all';
import { setupSwagger } from './swagger.config';
import { CSRF_TOKEN_COOKIE } from './auth/token-cookies';

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

    if (process.env.DEBUG_POLICY === '1') {
      // eslint-disable-next-line no-console
      console.error('[AllExceptionsFilter]', exception);
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

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Internal Server Error',
      meta: String(exception?.message ?? exception),
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
  app.use(cookieParser());

  // 🔒 Configured for Next.js (localhost:3000) – allows credentials & cross-origin cookies.
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:4200',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'x-org-id',
      'x-session-token',
      'x-csrf-token',
      'x-cid',
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

  // Těžké bootstrapy jen mimo testy (lze vypnout flagem)
  if (
    process.env.NODE_ENV !== 'test' &&
    process.env.DISABLE_BOOTSTRAP_SEARCH !== '1'
  ) {
    try {
      const prisma = app.get(PrismaService);
      await bootstrapSearchAll(prisma);
    } catch (e: any) {
      console.error('bootstrapSearchAll failed:', e?.message ?? e);
      // případně process.exit(1) – podle tvého rozhodnutí
    }
  }

  return app;
}

/**
 * Produkční/dev bootstrap (spouští HTTP server).
 * V test módu se server nespouští – v e2e si zavolej `createApp()` + `app.init()`.
 */
async function bootstrap() {
  const app = await createApp();

  if (process.env.NODE_ENV !== 'test') {
    if (process.env.NODE_ENV !== 'production') {
      setupSwagger(app);
    }
    await app.listen(process.env.PORT ?? 4200);
  } else {
    // e2e: pouze inicializace bez otevření portu
    await app.init();
  }
}
bootstrap();
