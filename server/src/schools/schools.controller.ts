import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'generated/prisma';
import { SchoolAccessGuard } from 'src/auth/guards/school-access.guard';
import { CreateSchoolDto } from './dto/create-school.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Controller('schools')
@ApiBearerAuth()
@ApiTags('Schools')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  @Roles(Role.SUPERADMIN, Role.DIRECTOR)
  create(@Body() dto: CreateSchoolDto) {
    return this.schoolsService.create(dto);
  }

  @Get(':id')
  @Roles(Role.SUPERADMIN, Role.DIRECTOR, Role.TEACHER, Role.STUDENT)
  @UseGuards(SchoolAccessGuard)
  findOne(@Param('id') id: string) {
    return this.schoolsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPERADMIN, Role.DIRECTOR)
  @UseGuards(SchoolAccessGuard)
  update(@Param('id') id: string, @Body() dto: UpdateSchoolDto) {
    return this.schoolsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPERADMIN, Role.DIRECTOR)
  @UseGuards(SchoolAccessGuard)
  remove(@Param('id') id: string) {
    return this.schoolsService.remove(id);
  }
}
