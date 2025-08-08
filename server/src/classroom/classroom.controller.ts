// src/modules/class-section/class-section.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { OrganizationRole, SystemRole, SchoolGrade } from '@prisma/client';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthGuard } from '@nestjs/passport';

import { CreateClassSectionDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import { ClassroomService } from './classroom.service';

@ApiTags('Classroom')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('class-sections')
export class ClassroomController {
  constructor(private readonly classSectionService: ClassroomService) {}

  @Post()
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  create(@Body() dto: CreateClassSectionDto, @Request() req) {
    return this.classSectionService.create(dto, req.user);
  }

  @Get()
  @ApiQuery({ name: 'yearId', required: true })
  @ApiQuery({ name: 'grade', enum: SchoolGrade, required: false })
  findAll(
    @Query('yearId', new ParseUUIDPipe()) yearId: string,
    @Request() req,
  ) {
    return this.classSectionService.findAll(yearId, req.user);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.classSectionService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateClassroomDto,
    @Request() req,
  ) {
    return this.classSectionService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.classSectionService.remove(id, req.user);
  }
}
