import { Module } from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { TeachersController } from './teachers.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  providers: [TeachersService],
  imports: [PrismaModule],
  controllers: [TeachersController],
})
export class TeachersModule {}
