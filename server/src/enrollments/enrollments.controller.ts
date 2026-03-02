// YEAR-SCOPED: Requires current academic year (RequireCurrentAcademicYearGuard)
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  ParseUUIDPipe,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@/modules/rbac/permission.decorator';
import { PermissionKey } from '@prisma/client';
import { RequestWithUser } from '@/types/request-with-user';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { BulkEnrollmentDto } from './dto/bulk-enrollment.dto';
import { TransferEnrollmentDto } from './dto/transfer-enrollment.dto';
import { QueryEnrollmentsDto } from './dto/query-enrollments.dto';
import { RequireCurrentAcademicYearGuard } from '@/academic-years/require-current-academic-year.guard';
import { OrgOperation, OrgOperationType } from '@/common/decorators/org-operation.decorator';
import { OrgContextService } from '@/common/org-context/org-context.service';

@ApiTags('Enrollments')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('enrollments')
@OrgOperation(OrgOperationType.EXECUTION)
@UseGuards(RequireCurrentAcademicYearGuard)
export class EnrollmentsController {
  constructor(
    private readonly service: EnrollmentsService,
    private readonly orgContext: OrgContextService,
  ) {}

  @Post()
  @Permission(PermissionKey.MANAGE_STUDENTS)
  @ApiOperation({ summary: 'Create enrollment (student ↔ class section)' })
  async create(@Body() dto: CreateEnrollmentDto, @Req() req: RequestWithUser) {
    const ctx = await this.orgContext.get(req);
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException('Missing active academic year.');
    }
    const classSectionId = dto.classSectionId ?? dto.classroomId;
    const academicYearId = ctx.activeAcademicYearId;
    if (!classSectionId) {
      throw new BadRequestException('Chybí classroomId.');
    }
    if (
      (dto.yearId && dto.yearId !== ctx.activeAcademicYearId) ||
      (dto.academicYearId && dto.academicYearId !== ctx.activeAcademicYearId)
    ) {
      throw new BadRequestException('yearId / academicYearId is not allowed.');
    }
    return ok(this.service.create({ ...dto, classSectionId, academicYearId }, req.user));
  }

  @Post('bulk')
  @Permission(PermissionKey.MANAGE_STUDENTS)
  @ApiOperation({ summary: 'Bulk enrollment (create students and enroll them)' })
  async bulk(@Body() dto: BulkEnrollmentDto, @Req() req: RequestWithUser) {
    const ctx = await this.orgContext.get(req);
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException('Missing active academic year.');
    }
    const classSectionId = dto.classSectionId ?? dto.classroomId;
    if (!classSectionId) {
      throw new BadRequestException('Chybí classroomId.');
    }
    if (dto.academicYearId && dto.academicYearId !== ctx.activeAcademicYearId) {
      throw new BadRequestException('academicYearId is not allowed.');
    }
    return ok(
      this.service.bulkCreate(
        { ...dto, classSectionId, academicYearId: ctx.activeAcademicYearId },
        req.user,
      ),
    );
  }

  @Get()
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'List enrollments for a class section' })
  async list(@Query() q: QueryEnrollmentsDto, @Req() req: RequestWithUser) {
    const ctx = await this.orgContext.get(req);
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException('Missing active academic year.');
    }
    const classSectionId = q.classSectionId ?? q.classroomId;
    if (!classSectionId) {
      throw new BadRequestException('Chybí classroomId.');
    }
    if (q.academicYearId && q.academicYearId !== ctx.activeAcademicYearId) {
      throw new BadRequestException('academicYearId is not allowed.');
    }
    return ok(
      this.service.listByClassSection(
        classSectionId,
        ctx.activeAcademicYearId,
        req.user,
      ),
    );
  }

  @Delete(':id')
  @Permission(PermissionKey.MANAGE_STUDENTS)
  @ApiOperation({ summary: 'Soft delete enrollment (set status=LEFT)' })
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: RequestWithUser) {
    return ok(this.service.softDelete(id, req.user));
  }

  @Post(':id/transfer')
  @Permission(PermissionKey.MANAGE_STUDENTS)
  @ApiOperation({ summary: 'Přestup studenta do jiné třídy (v rámci téhož roku)' })
  transfer(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: TransferEnrollmentDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.transfer(id, dto, req.user));
  }
}
