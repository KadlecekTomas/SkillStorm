import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuditModule } from '@/audit/audit.module';
import { CatalogController } from './catalog.controller';
import { CatalogPlatformController } from './catalog-platform.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CatalogController, CatalogPlatformController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
