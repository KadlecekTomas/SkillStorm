import { Module } from '@nestjs/common';
import { AuditModule } from '@/audit/audit.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { LessonExperienceController } from './lesson-experience.controller';
import { LessonExperiencePlatformController } from './lesson-experience-platform.controller';
import { LessonExperienceService } from './lesson-experience.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [LessonExperienceController, LessonExperiencePlatformController],
  providers: [LessonExperienceService],
  exports: [LessonExperienceService],
})
export class LessonExperienceModule {}
