import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { HttpExceptionFilter } from './infra/http-exception.filter';
// případně NoopRedis/disable cron přes env

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'test' ? false : undefined,
  });

  // stejné globální pipy jako prod
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // jednotný error mapping → 400/403/409 místo 500
  app.useGlobalFilters(new HttpExceptionFilter());

  // e2e nesmí pouštět těžké bootstrapy
  if (
    process.env.NODE_ENV !== 'test' &&
    process.env.DISABLE_BOOTSTRAP_SEARCH !== '1'
  ) {
    try {
      const prisma = app.get(PrismaService);
      const { bootstrapSearchAll } = await import('./db/bootstrap-search-all');
      await bootstrapSearchAll(prisma);
    } catch (e: any) {
      // v prod si rozhodni, jestli killnout proces
      console.error('bootstrapSearchAll failed:', e?.message ?? e);
    }
  }

  return app;
}
