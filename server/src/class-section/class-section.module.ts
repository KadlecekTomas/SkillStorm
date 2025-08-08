import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClassSectionController } from './class-section.controller';
import { ClassSectionService } from './class-section.service';

@Module({
  controllers: [ClassSectionController],
  providers: [ClassSectionService, PrismaService],
})
export class ClassSectionModule {}
