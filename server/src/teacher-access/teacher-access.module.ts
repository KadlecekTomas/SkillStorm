import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TeacherAccessController } from './teacher-access.controller';
import { TeacherAccessService } from './teacher-access.service';

@Module({
  controllers: [TeacherAccessController],
  providers: [TeacherAccessService, PrismaService],
  exports: [TeacherAccessService],
})
export class TeacherAccessModule {}
