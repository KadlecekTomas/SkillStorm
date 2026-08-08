import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { SchoolPeopleController } from './school-people.controller';
import { SchoolPeopleService } from './school-people.service';
import { PrismaService } from '@/prisma/prisma.service';

@Module({
  controllers: [UsersController, SchoolPeopleController],
  providers: [UsersService, SchoolPeopleService, PrismaService],
})
export class UsersModule {}
