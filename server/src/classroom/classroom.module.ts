import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ClassSectionsController } from './class-sections.controller';
import { ClassroomsController } from './classrooms.controller';
import { ClassSectionsService } from './class-sections.service';

@Module({
  controllers: [ClassSectionsController, ClassroomsController],
  providers: [ClassSectionsService, PrismaService],
})
export class ClassroomModule {}
