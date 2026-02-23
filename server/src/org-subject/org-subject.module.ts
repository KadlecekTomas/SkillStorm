import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { OrgSubjectController } from './org-subject.controller';
import { OrgSubjectService } from './org-subject.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrgSubjectController],
  providers: [OrgSubjectService],
  exports: [OrgSubjectService],
})
export class OrgSubjectModule {}
