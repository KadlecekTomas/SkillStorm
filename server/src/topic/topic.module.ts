import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TopicsController } from './topic.controller';
import { TopicsService } from './topic.service';

@Module({
  controllers: [TopicsController],
  providers: [TopicsService, PrismaService],
  exports: [TopicsService],
})
export class TopicsModule {}
