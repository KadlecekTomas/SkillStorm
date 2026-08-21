import { Module } from '@nestjs/common';
import { ActivityModule } from '@/activity-engine/activity.module';
import { CurriculumModule } from '@/curriculum/curriculum.module';
import { LessonExperienceModule } from '@/lesson-experience/lesson-experience.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { ContentPackPublisherService } from './content-pack-publisher.service';

@Module({
  imports: [
    PrismaModule,
    CurriculumModule,
    ActivityModule,
    LessonExperienceModule,
  ],
  providers: [ContentPackPublisherService],
  exports: [ContentPackPublisherService],
})
export class ContentPacksModule {}
