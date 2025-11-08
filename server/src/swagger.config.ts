import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildPermissionMarkdownTable } from './modules/rbac/permission-map';

function getAppVersion(): string {
  try {
    const raw = readFileSync(
      process.env.NEST_PACKAGE_PATH ?? join(process.cwd(), 'package.json'),
      'utf8',
    );
    const pkg = JSON.parse(raw);
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function setupSwagger(app: INestApplication) {
  const rbacOverview = buildPermissionMarkdownTable();
  const config = new DocumentBuilder()
    .setTitle('SkillStorm API')
    .setDescription(
      `API reference for the SkillStorm learning management platform.\n\n### RBAC Overview\n${rbacOverview}`,
    )
    .setVersion(getAppVersion())
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Use a valid access token.',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
