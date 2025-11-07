import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClassSectionController } from './class-section.controller';
import { ClassSectionsService } from './class-section.service';

@Module({
  controllers: [ClassSectionController],
  providers: [ClassSectionsService, PrismaService],
})
export class ClassSectionModule {}
