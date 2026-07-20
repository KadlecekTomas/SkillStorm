import { Module } from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { MembershipRolesService } from './membership-roles.service';
import { MembershipsController } from './memberships.controller';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditModule } from '@/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [MembershipsController],
  providers: [MembershipsService, MembershipRolesService, PrismaService],
  exports: [MembershipRolesService],
})
export class MembershipsModule {}
