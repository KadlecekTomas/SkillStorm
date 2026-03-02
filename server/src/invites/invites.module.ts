import { Module } from '@nestjs/common';
import { InvitesController } from './invites.controller';
import { InvitationsController } from './invitations.controller';
import { InvitesService } from './invites.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/auth/auth.module';
import { AuditModule } from '@/audit/audit.module';
import { RbacModule } from '@/modules/rbac/rbac.module';
import { EventsModule } from '@/events/events.module';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, RbacModule, EventsModule],
  controllers: [InvitesController, InvitationsController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
