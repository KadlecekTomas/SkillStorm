// src/teachers/teachers.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RequestWithUser } from '@/types/request-with-user';
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

import { Permission } from '@/modules/rbac/permission.decorator';
import { PermissionKey } from '@prisma/client';

import { InvalidateScopes } from '@/common/cache/invalidate.decorator';

@ApiTags('Teachers')
@ApiBearerAuth()
@Controller('teachers')
export class TeachersController {
  constructor(private readonly service: TeachersService) {}

  // ---------- CREATE ----------
  @Post()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Create teacher (director or superadmin)' })
  @InvalidateScopes(({ req }) => [req.body?.organizationId].filter(Boolean))
  create(@Body() dto: CreateTeacherDto, @Req() req: RequestWithUser) {
    return this.service.create(dto, req.user);
  }

  // ---------- LIST ----------
  @Get()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'List teachers (org‑scoped for director)' })
  @ApiQuery({ name: 'organizationId', required: false, type: String })
  @CacheTTL(0) // čtecí endpoint: vypnout HTTP response cache, používáme verzovanou cache v service
  findAll(@Req() req: RequestWithUser, @Query() q: QueryTeachersDto) {
    return this.service.findAll(req.user, q);
  }

  // ---------- DETAIL ----------
  @Get(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Get teacher detail' })
  @CacheTTL(0) // čtecí endpoint: viz výše
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.findOne(id, req.user);
  }

  // ---------- UPDATE ----------
  @Patch(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Update teacher (director or superadmin)' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTeacherDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.update(id, dto, req.user);
  }

  // ---------- DELETE (soft) ----------
  @Delete(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Soft delete teacher (director or superadmin)' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.remove(id, req.user);
  }

  // ---------- SUBJECTS: bulk add/replace ----------
  @Post(':id/subjects')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Přiřadit předměty učiteli (bulk add/replace)' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  assignSubjects(
    @Param('id', new ParseUUIDPipe()) teacherId: string,
    @Body() dto: AssignSubjectsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.assignSubjects(teacherId, dto, req.user);
  }

  // ---------- SUBJECTS: remove single link ----------
  @Delete(':id/subjects/:subjectId')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Odebrat jedno přiřazení předmětu učiteli' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  removeSubject(
    @Param('id', new ParseUUIDPipe()) teacherId: string,
    @Param('subjectId', new ParseUUIDPipe()) subjectId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.removeSubject(teacherId, subjectId, req.user);
  }
}
