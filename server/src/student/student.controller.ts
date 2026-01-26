// src/modules/students/student.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';

import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { OrganizationRole, SystemRole, PermissionKey } from '@prisma/client';
import { StudentsService } from './student.service';
import { QueryStudentsDto } from './dto/query-students.dto';
import { ExportStudentsDto } from './dto/export-students.dto';
import { Response } from 'express';
import { RequestWithUser } from '@/types/request-with-user';

import { InvalidateScopes } from '@/common/cache/invalidate.decorator';
import { Permission } from '@/modules/rbac/permission.decorator';

@ApiTags('Students')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  // ---------- EXPORT ----------
  // src/modules/students/student.controller.ts
  @Get('export')
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.OWNER, OrganizationRole.DIRECTOR)
  async export(
    @Req() req: RequestWithUser,
    @Query() q: ExportStudentsDto,
    @Res() res: Response,
  ) {
    const { buffer, contentType, filename } = await this.service.export(
      req.user,
      q,
    );
    const isCsv = contentType.toLowerCase().startsWith('text/csv');

    res.status(200).set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    if (isCsv) {
      // ✅ Supertest → res.text dostupné
      res.send(buffer.toString('utf8'));
    } else {
      // ✅ Supertest → res.body je Buffer
      res.end(buffer);
    }
  }

  // ---------- CREATE ----------
  @Post()
  @Permission(PermissionKey.MANAGE_STUDENTS)
  @ApiOperation({ summary: 'Create new student' })
  @InvalidateScopes(({ result }) => (result?.orgId ? [result.orgId] : []))
  create(@Body() dto: CreateStudentDto, @Req() req: RequestWithUser) {
    return this.service.create(dto, req.user);
  }

  // ---------- LIST ----------
  // Pozn.: Učitel v cizí org → 403 (RbacGuard ho sem nepustí)
  @Get()
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.OWNER, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'List students (pagination + filters)' })
  @CacheTTL(0)
  findAll(@Req() req: RequestWithUser, @Query() q: QueryStudentsDto) {
    return this.service.findAll(req.user, q);
  }

  // ---------- DETAIL ----------
  @Get(':id')
  @Permission(PermissionKey.MANAGE_STUDENTS, OrganizationRole.STUDENT)
  @ApiOperation({ summary: 'Get student by ID' })
  @CacheTTL(0)
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.findOne(id, req.user);
  }

  // ---------- UPDATE ----------
  @Patch(':id')
  @Permission(PermissionKey.MANAGE_STUDENTS)
  @ApiOperation({ summary: 'Update student by ID' })
  @InvalidateScopes(({ result }) => (result?.orgId ? [result.orgId] : []))
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStudentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.update(id, dto, req.user);
  }

  // ---------- DELETE (soft) ----------
  @Delete(':id')
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.OWNER, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Soft delete student by ID' })
  @InvalidateScopes(({ result }) => (result?.orgId ? [result.orgId] : []))
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.remove(id, req.user);
  }
}
