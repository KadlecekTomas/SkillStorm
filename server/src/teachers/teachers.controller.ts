import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Role } from 'generated/prisma';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { SchoolAccessGuard } from 'src/auth/guards/school-access.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Post()
  @Roles(Role.SUPERADMIN, Role.DIRECTOR)
  create(@Body() dto: CreateTeacherDto) {
    return this.teachersService.create(dto);
  }

  @Get(':id')
  @Roles(Role.SUPERADMIN, Role.DIRECTOR)
  @UseGuards(SchoolAccessGuard)
  findOne(@Param('id') id: string) {
    return this.teachersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPERADMIN, Role.DIRECTOR)
  @UseGuards(SchoolAccessGuard)
  update(@Param('id') id: string, @Body() dto: UpdateTeacherDto) {
    return this.teachersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPERADMIN, Role.DIRECTOR)
  @UseGuards(SchoolAccessGuard)
  remove(@Param('id') id: string) {
    return this.teachersService.remove(id);
  }
}
