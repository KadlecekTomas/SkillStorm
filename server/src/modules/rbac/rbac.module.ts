import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { RbacService } from './rbac.service';
import { RbacGuard } from './rbac.guard';
import { RbacPolicyService } from './rbac-policy.service';
import { RbacDefaultSyncService } from './rbac-default-sync.service';

@Module({
  imports: [PrismaModule],
  providers: [RbacService, RbacGuard, RbacPolicyService, RbacDefaultSyncService],
  exports: [RbacService, RbacGuard, RbacPolicyService],
})
export class RbacModule {}
