import { NestFactory } from '@nestjs/core';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { bootstrapSearchAll } from './db/bootstrap-search-all';
import { setupSwagger } from './swagger.config';

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
      return res
        .status(status)
        .json(typeof body === 'string' ? { message: body } : body);
    }

    if (exception instanceof ZodError) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Validation failed',
        issues: exception.issues,
      });
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': // unique violation
          return res.status(HttpStatus.CONFLICT).json({
            statusCode: 409,
            message: 'Unique constraint failed',
            meta: exception.meta,
          });
        case 'P2003': // foreign key
          return res.status(HttpStatus.BAD_REQUEST).json({
            statusCode: 400,
            message: 'Foreign key constraint failed',
            meta: exception.meta,
          });
        case 'P2025': // not found
          return res.status(HttpStatus.NOT_FOUND).json({
            statusCode: 404,
            message: 'Record not found',
            meta: exception.meta,
          });
      }
    }

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: 'Internal Server Error',
      error: String(exception?.message ?? exception),
    });
  }
}

/**
 * Společná factory – používej ji v prod (main) i v e2e testech.
 */
export async function createApp(): Promise<INestApplication> {
  const isTest = process.env.NODE_ENV === 'test';
  const enableTestLogging = process.env.DEBUG_POLICY === '1';
  const app = await NestFactory.create(AppModule, {
    logger: isTest && !enableTestLogging ? false : undefined,
  });

  const corsOrigins =
    process.env.CORS_ORIGINS ?? 'http://localhost:4200,http://localhost:3000';
  const allowedOrigins = corsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length ? allowedOrigins : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
    ],
  });

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
    setupSwagger(app);
    await app.listen(process.env.PORT ?? 3001);
  } else {
    // e2e: pouze inicializace bez otevření portu
    await app.init();
  }
}
bootstrap();
