import { Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { StudentsController } from './student.controller';
import { StudentsService } from './student.service';

@Module({
  controllers: [StudentsController],
  providers: [StudentsService, PrismaService],
})
export class StudentsModule {}
