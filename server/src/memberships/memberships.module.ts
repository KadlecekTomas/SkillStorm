import { Module } from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { MembershipsController } from './memberships.controller';
import { PrismaService } from '@/prisma/prisma.service';

@Module({
  controllers: [MembershipsController],
  providers: [MembershipsService, PrismaService],
})
export class MembershipsModule {}
