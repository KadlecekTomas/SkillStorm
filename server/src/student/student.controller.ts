// YEAR-SCOPED: Requires current academic year (RequireCurrentAcademicYearGuard)
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
  UseGuards,
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

import { Permission } from '@/modules/rbac/permission.decorator';
import { RequireCurrentAcademicYearGuard } from '@/academic-years/require-current-academic-year.guard';
import { AcademicYearExpiredGuard } from '@/academic-years/academic-year-expired.guard';
import { StudentAccessGuard } from './guards/student-access.guard';
import { Throttle } from '@nestjs/throttler';
import { OrgOperation, OrgOperationType } from '@/common/decorators/org-operation.decorator';
import { StudentDiagnosticService } from '@/analytics/student-diagnostic.service';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';

@ApiTags('Students')
@ApiBearerAuth()
@Controller('students')
@OrgOperation(OrgOperationType.EXECUTION)
@UseGuards(RequireCurrentAcademicYearGuard, AcademicYearExpiredGuard)
export class StudentsController {
  constructor(
    private readonly service: StudentsService,
    private readonly diagnosticService: StudentDiagnosticService,
  ) {}

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
  create(@Body() dto: CreateStudentDto, @Req() req: RequestWithUser) {
    return this.service.create(dto, req.user);
  }

  // ---------- LIST ----------
  // Pozn.: Učitel v cizí org → 403 (RbacGuard ho sem nepustí)
  @Get()
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.OWNER, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'List students (pagination + filters)' })
  @NoHttpCache()
  @CacheTTL(0)
  findAll(@Req() req: RequestWithUser, @Query() q: QueryStudentsDto) {
    return this.service.findAll(req.user, q);
  }

  // ---------- GDPR DETAIL (minimal data, access-controlled) ----------
  @Get(':id/detail')
  @UseGuards(StudentAccessGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'GDPR-minimal student detail' })
  @CacheTTL(0)
  getDetail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
    @Query('yearId') yearId?: string,
  ) {
    return this.service.getDetail(id, req.user, yearId);
  }

  @Get(':id/diagnostic')
  @UseGuards(StudentAccessGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Deterministic student diagnostic summary' })
  @CacheTTL(0)
  getDiagnostic(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
    @Query('yearId') yearId?: string,
  ) {
    return this.diagnosticService.getStudentDiagnostic(id, req.user, yearId);
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
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.remove(id, req.user);
  }
}
