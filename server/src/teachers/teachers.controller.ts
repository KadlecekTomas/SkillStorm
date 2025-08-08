import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { QueryTeachersDto } from './dto/query-teachers.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { SystemRole, OrganizationRole } from '@prisma/client';
import { AssignSubjectsDto } from './dto/assign-subjects.dto';

@ApiTags('Teachers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('teachers')
export class TeachersController {
  constructor(private readonly service: TeachersService) {}

  @Post()
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Create teacher (director or superadmin)' })
  create(@Body() dto: CreateTeacherDto, @Request() req) {
    return this.service.create(dto, req.user);
  }

  @Get()
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'List teachers (org‑scoped for director)' })
  findAll(@Request() req, @Query() q: QueryTeachersDto) {
    return this.service.findAll(req.user, q);
  }

  @Get(':id')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Get teacher detail' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Update teacher (director or superadmin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Soft delete teacher (director or superadmin)' })
  remove(@Param('id') id: string, @Request() req) {
    return this.service.remove(id, req.user);
  }

  @Post(':id/subjects')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Přiřadit předměty učiteli (bulk add/replace)' })
  assignSubjects(
    @Param('id') teacherId: string,
    @Body() dto: AssignSubjectsDto,
    @Request() req,
  ) {
    return this.service.assignSubjects(teacherId, dto, req.user);
  }

  @Delete(':id/subjects/:subjectId')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Odebrat jedno přiřazení předmětu učiteli' })
  removeSubject(
    @Param('id') teacherId: string,
    @Param('subjectId') subjectId: string,
    @Request() req,
  ) {
    return this.service.removeSubject(teacherId, subjectId, req.user);
  }
}
