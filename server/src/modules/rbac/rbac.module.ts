import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RbacService } from './rbac.service';
import { RbacGuard } from './rbac.guard';
import { RbacPolicyService } from './rbac-policy.service';

@Module({
  imports: [PrismaModule],
  providers: [RbacService, RbacGuard, RbacPolicyService],
  exports: [RbacService, RbacGuard, RbacPolicyService],
})
export class RbacModule {}
