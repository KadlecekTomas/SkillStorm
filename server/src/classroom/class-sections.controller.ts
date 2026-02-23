// YEAR-SCOPED: Requires current academic year (RequireCurrentAcademicYearGuard)
// src/modules/classroom/class-sections.controller.ts
import {
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
import { ClassSectionsService } from './class-sections.service';
import { InvalidateScopes } from '@/common/cache/invalidate.decorator';
import { Permission } from '@/modules/rbac/permission.decorator';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { RequireCurrentAcademicYearGuard } from '@/academic-years/require-current-academic-year.guard';
import { AllowPendingOrg } from '@/common/decorators/allow-pending-org.decorator';
import { OrgOperation, OrgOperationType } from '@/common/decorators/org-operation.decorator';

@ApiTags('ClassSections')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('class-sections')
@OrgOperation(OrgOperationType.AUTHORING)
@AllowPendingOrg()
@UseGuards(RequireCurrentAcademicYearGuard)
export class ClassSectionsController {
  constructor(private readonly service: ClassSectionsService) {}

  @Post()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Create class section' })
  @InvalidateScopes(({ result, req }) =>
    [result?.orgId ?? req?.user?.organizationId].filter(Boolean),
  )
  async create(@Body() dto: CreateClassSectionDto, @Req() req: RequestWithUser) {
    return ok(this.service.create(dto, req.user));
  }

  @Get()
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'List class sections' })
  async findAll(@Req() req: RequestWithUser, @Query() q: QueryClassSectionsDto) {
    return ok(this.service.findAll(q, req.user));
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
  @InvalidateScopes(({ result }) => (result?.orgId ? [result.orgId] : []))
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
  @InvalidateScopes(({ result }) => (result?.orgId ? [result.orgId] : []))
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.remove(id, req.user));
  }

  @Patch(':id/homeroom')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Nastavit/odstranit třídnictví (homeroom teacher)' })
  @InvalidateScopes(({ result, req }) =>
    [result?.academicYear?.orgId ?? req?.user?.organizationId].filter(Boolean),
  )
  setHomeroom(
    @Param('id', new ParseUUIDPipe()) classSectionId: string,
    @Body() dto: SetHomeroomDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.setHomeroom(classSectionId, dto, req.user));
  }
}
