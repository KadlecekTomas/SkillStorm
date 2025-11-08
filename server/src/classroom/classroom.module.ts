import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClassSectionsController } from './class-sections.controller';
import { ClassSectionsService } from './class-sections.service';

@Module({
  controllers: [ClassSectionsController],
  providers: [ClassSectionsService, PrismaService],
})
export class ClassroomModule {}
