// src/modules/students/student.controller.ts
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
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';

import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { StudentsService } from './student.service';
import { QueryStudentsDto } from './dto/query-students.dto';
import { ExportStudentsDto } from './dto/export-students.dto';
import { Response } from 'express';

import { InvalidateScopes } from 'src/common/cache/invalidate.decorator';

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  // ---------- EXPORT ----------
  // src/modules/students/student.controller.ts
  @Get('export')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  async export(
    @Request() req,
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
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Create new student' })
  @InvalidateScopes(({ result }) => (result?.orgId ? [result.orgId] : []))
  create(@Body() dto: CreateStudentDto, @Request() req) {
    return this.service.create(dto, req.user);
  }

  // ---------- LIST ----------
  // Pozn.: Učitel v cizí org → 403 (RolesGuard ho sem ani nepustí)
  @Get()
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'List students (pagination + filters)' })
  @CacheTTL(0)
  findAll(@Request() req, @Query() q: QueryStudentsDto) {
    return this.service.findAll(req.user, q);
  }

  // ---------- DETAIL ----------
  @Get(':id')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
    OrganizationRole.STUDENT, // ⬅️ důležité pro self‑access
  )
  @ApiOperation({ summary: 'Get student by ID' })
  @CacheTTL(0)
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.service.findOne(id, req.user);
  }

  // ---------- UPDATE ----------
  @Patch(':id')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Update student by ID' })
  @InvalidateScopes(({ result }) => (result?.orgId ? [result.orgId] : []))
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStudentDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user);
  }

  // ---------- DELETE (soft) ----------
  @Delete(':id')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Soft delete student by ID' })
  @InvalidateScopes(({ result }) => (result?.orgId ? [result.orgId] : []))
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.service.remove(id, req.user);
  }
}
