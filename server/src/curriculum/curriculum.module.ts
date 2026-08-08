import { Module } from '@nestjs/common';
import { AuditModule } from '@/audit/audit.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { CurriculumController } from './curriculum.controller';
import { CurriculumPlatformController } from './curriculum-platform.controller';
import { CurriculumService } from './curriculum.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CurriculumController, CurriculumPlatformController],
  providers: [CurriculumService],
  exports: [CurriculumService],
})
export class CurriculumModule {}
