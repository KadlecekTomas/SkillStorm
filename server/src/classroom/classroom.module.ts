import { Module } from '@nestjs/common';
import { ClassroomService } from './classroom.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClassroomController } from './classroom.controller';

@Module({
  controllers: [ClassroomController],
  providers: [ClassroomService, PrismaService],
})
export class ClassroomModule {}
