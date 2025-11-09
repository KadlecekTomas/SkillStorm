// src/modules/subjects/subjects.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SubjectsController } from './subject.controller';
import { SubjectsService } from './subject.service';

@Module({
  controllers: [SubjectsController],
  providers: [SubjectsService, PrismaService],
})
export class SubjectsModule {}
