// YEAR-SCOPED: Requires current academic year (RequireCurrentAcademicYearGuard)
// src/modules/classroom/class-sections.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequestWithUser } from '@/types/request-with-user';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { PermissionKey } from '@prisma/client';
import { CreateClassSectionDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import { SetHomeroomDto } from './dto/set-homeroom.dto';
import { QueryClassSectionsDto } from './dto/query-class-sections.dto';
import { AttachOrgSubjectsDto } from './dto/attach-org-subjects.dto';
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { ClassSectionsService } from './class-sections.service';
import { InvalidateScopes } from '@/common/cache/invalidate.decorator';
import { Permission } from '@/modules/rbac/permission.decorator';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { RequireCurrentAcademicYearGuard } from '@/academic-years/require-current-academic-year.guard';
import { AcademicYearExpiredGuard } from '@/academic-years/academic-year-expired.guard';
import { AllowPendingOrg } from '@/common/decorators/allow-pending-org.decorator';
import { OrgOperation, OrgOperationType } from '@/common/decorators/org-operation.decorator';
import { OrgContextService } from '@/common/org-context/org-context.service';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';

@ApiTags('ClassSections')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('class-sections')
@OrgOperation(OrgOperationType.AUTHORING)
@AllowPendingOrg()
@UseGuards(RequireCurrentAcademicYearGuard, AcademicYearExpiredGuard)
export class ClassSectionsController {
  constructor(
    private readonly service: ClassSectionsService,
    private readonly orgContext: OrgContextService,
  ) {}

  @Post()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Create class section' })
  async create(@Body() dto: CreateClassSectionDto, @Req() req: RequestWithUser) {
    const ctx = await this.orgContext.get(req);
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException('Missing active academic year.');
    }
    if (
      (dto.yearId && dto.yearId !== ctx.activeAcademicYearId) ||
      (dto.academicYearId && dto.academicYearId !== ctx.activeAcademicYearId)
    ) {
      throw new BadRequestException('yearId/academicYearId body is not allowed');
    }
    return ok(
      this.service.create(
        {
          ...dto,
          yearId: ctx.activeAcademicYearId,
          academicYearId: ctx.activeAcademicYearId,
        },
        req.user,
      ),
    );
  }

  @Get()
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'List class sections' })
  @NoHttpCache()
  @CacheTTL(0) // vypnout HTTP response cache – používáme verzovanou cache v service
  async findAll(@Req() req: RequestWithUser, @Query() q: QueryClassSectionsDto) {
    const ctx = await this.orgContext.get(req);
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException('Missing active academic year.');
    }
    if (q.yearId && q.academicYearId && q.yearId !== q.academicYearId) {
      throw new BadRequestException('academicYearId a yearId se musí shodovat.');
    }
    const requestedYearId = q.yearId ?? q.academicYearId ?? ctx.activeAcademicYearId;
    return ok(
      this.service.findAll(
        {
          ...q,
          yearId: requestedYearId,
          academicYearId: requestedYearId,
        },
        req.user,
      ),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail třídy' })
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS)
  @CacheTTL(0)
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.findOne(id, req.user));
  }

  @Get(':id/org-subjects')
  @ApiOperation({ summary: 'List subjects assigned to class section' })
  @Permission(PermissionKey.MANAGE_TEACHERS, PermissionKey.VIEW_RESULTS)
  @CacheTTL(0)
  listOrgSubjects(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.listOrgSubjects(id, req.user));
  }

  @Post(':id/org-subjects')
  @ApiOperation({ summary: 'Attach subjects to class section' })
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @InvalidateScopes(({ req }) =>
    [req?.user?.organizationId].filter(Boolean),
  )
  attachOrgSubjects(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AttachOrgSubjectsDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.attachOrgSubjects(id, dto, req.user));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Úprava třídy' })
  @Permission(PermissionKey.MANAGE_TEACHERS)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateClassroomDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.update(id, dto, req.user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Smazání třídy' })
  @Permission(PermissionKey.MANAGE_TEACHERS)
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.remove(id, req.user));
  }

  @Patch(':id/homeroom')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Nastavit/odstranit třídnictví (homeroom teacher)' })
  setHomeroom(
    @Param('id', new ParseUUIDPipe()) classSectionId: string,
    @Body() dto: SetHomeroomDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.setHomeroom(classSectionId, dto, req.user));
  }

  @Post(':id/teachers')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Assign teacher to class section (explicit teaching role)' })
  async assignTeacher(
    @Param('id', new ParseUUIDPipe()) classSectionId: string,
    @Body() dto: AssignTeacherDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(
      this.service.assignTeacherToClass(classSectionId, dto.teacherId, ctx.organizationId),
    );
  }

  @Delete(':id/teachers/:teacherId')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Remove teacher from class section (soft-delete assignment)' })
  async removeTeacher(
    @Param('id', new ParseUUIDPipe()) classSectionId: string,
    @Param('teacherId', new ParseUUIDPipe()) teacherId: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(
      this.service.removeTeacherFromClass(classSectionId, teacherId, ctx.organizationId),
    );
  }
}
