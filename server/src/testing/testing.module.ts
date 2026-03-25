import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { TestingController } from './testing.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TestingController],
})
export class TestingModule {}
