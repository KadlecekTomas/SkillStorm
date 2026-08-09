import { Module } from '@nestjs/common';
import { AuditModule } from '@/audit/audit.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { ActivityController } from './activity.controller';
import { ActivityPlatformController } from './activity-platform.controller';
import { ActivityService } from './activity.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ActivityController, ActivityPlatformController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
