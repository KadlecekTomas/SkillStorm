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

@ApiTags('Enrollments')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('enrollments')
@OrgOperation(OrgOperationType.EXECUTION)
@UseGuards(RequireCurrentAcademicYearGuard)
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  @Post()
  @Permission(PermissionKey.MANAGE_STUDENTS)
  @ApiOperation({ summary: 'Create enrollment (student ↔ class section)' })
  create(@Body() dto: CreateEnrollmentDto, @Req() req: RequestWithUser) {
    const classSectionId = dto.classSectionId ?? dto.classroomId;
    const academicYearId = dto.yearId ?? dto.academicYearId;
    if (!classSectionId) {
      throw new BadRequestException('Chybí classroomId.');
    }
    if (!academicYearId) {
      throw new BadRequestException('Chybí yearId / academicYearId.');
    }
    return ok(this.service.create({ ...dto, classSectionId, academicYearId }, req.user));
  }

  @Post('bulk')
  @Permission(PermissionKey.MANAGE_STUDENTS)
  @ApiOperation({ summary: 'Bulk enrollment (create students and enroll them)' })
  bulk(@Body() dto: BulkEnrollmentDto, @Req() req: RequestWithUser) {
    const classSectionId = dto.classSectionId ?? dto.classroomId;
    if (!classSectionId) {
      throw new BadRequestException('Chybí classroomId.');
    }
    if (!dto.academicYearId) {
      throw new BadRequestException('Chybí academicYearId.');
    }
    return ok(this.service.bulkCreate({ ...dto, classSectionId }, req.user));
  }

  @Get()
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'List enrollments for a class section' })
  list(@Query() q: QueryEnrollmentsDto, @Req() req: RequestWithUser) {
    const classSectionId = q.classSectionId ?? q.classroomId;
    if (!classSectionId) {
      throw new BadRequestException('Chybí classroomId.');
    }
    if (!q.academicYearId) {
      throw new BadRequestException('Chybí academicYearId.');
    }
    return ok(
      this.service.listByClassSection(
        classSectionId,
        q.academicYearId,
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
