import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { bootstrapSearchAll } from './db/bootstrap-search-all';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const prisma = app.get(PrismaService);

  // spusť jen mimo testy, nebo ovladatelné přes flag
  if (
    process.env.NODE_ENV !== 'test' &&
    process.env.DISABLE_BOOTSTRAP_SEARCH !== '1'
  ) {
    try {
      await bootstrapSearchAll(prisma);
    } catch (e) {
      console.error('bootstrapSearchAll failed:', e?.message || e);
      // případně process.exit(1) pokud to považuješ za fatální
    }
  }

  const config = new DocumentBuilder()
    .setTitle('Test System API')
    .setDescription('The test system API description')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      in: 'header',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
