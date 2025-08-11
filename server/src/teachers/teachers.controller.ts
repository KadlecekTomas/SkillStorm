// src/teachers/teachers.controller.ts
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
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';

import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { QueryTeachersDto } from './dto/query-teachers.dto';
import { AssignSubjectsDto } from './dto/assign-subjects.dto';

import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { SystemRole, OrganizationRole } from '@prisma/client';

import { InvalidateScopes } from 'src/common/cache/invalidate.decorator';

@ApiTags('Teachers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('teachers')
export class TeachersController {
  constructor(private readonly service: TeachersService) {}

  // ---------- CREATE ----------
  @Post()
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Create teacher (director or superadmin)' })
  @InvalidateScopes(({ req }) => [req.body?.organizationId].filter(Boolean))
  create(@Body() dto: CreateTeacherDto, @Request() req) {
    return this.service.create(dto, req.user);
  }

  // ---------- LIST ----------
  @Get()
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'List teachers (org‑scoped for director)' })
  @ApiQuery({ name: 'organizationId', required: false, type: String })
  @CacheTTL(0) // čtecí endpoint: vypnout HTTP response cache, používáme verzovanou cache v service
  findAll(@Request() req, @Query() q: QueryTeachersDto) {
    return this.service.findAll(req.user, q);
  }

  // ---------- DETAIL ----------
  @Get(':id')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Get teacher detail' })
  @CacheTTL(0) // čtecí endpoint: viz výše
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.service.findOne(id, req.user);
  }

  // ---------- UPDATE ----------
  @Patch(':id')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Update teacher (director or superadmin)' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTeacherDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user);
  }

  // ---------- DELETE (soft) ----------
  @Delete(':id')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Soft delete teacher (director or superadmin)' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.service.remove(id, req.user);
  }

  // ---------- SUBJECTS: bulk add/replace ----------
  @Post(':id/subjects')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Přiřadit předměty učiteli (bulk add/replace)' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  assignSubjects(
    @Param('id', new ParseUUIDPipe()) teacherId: string,
    @Body() dto: AssignSubjectsDto,
    @Request() req,
  ) {
    return this.service.assignSubjects(teacherId, dto, req.user);
  }

  // ---------- SUBJECTS: remove single link ----------
  @Delete(':id/subjects/:subjectId')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Odebrat jedno přiřazení předmětu učiteli' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  removeSubject(
    @Param('id', new ParseUUIDPipe()) teacherId: string,
    @Param('subjectId', new ParseUUIDPipe()) subjectId: string,
    @Request() req,
  ) {
    return this.service.removeSubject(teacherId, subjectId, req.user);
  }
}
