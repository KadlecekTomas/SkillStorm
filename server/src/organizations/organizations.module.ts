import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, PrismaService],
})
export class OrganizationsModule {}
