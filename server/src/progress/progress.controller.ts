import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';
import type { RequestWithUser } from '@/types/request-with-user';
import {
  OrgOperation,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import { ProgressService } from './progress.service';
import {
  CreateProgressEntryDto,
  SyncProgressEntriesDto,
} from './dto/create-progress-entry.dto';
import { CreateAttendanceRecordDto } from './dto/create-attendance-record.dto';
import { CreateInterventionDto } from './dto/create-intervention.dto';
import { CreateCompetencyDto } from './dto/create-competency.dto';

/**
 * Jednoduché školní hodnocení. Server vždy odvozuje tenant/třídu/rok z JWT,
 * aktuálního enrollmentu a teacher-class vztahu; klient tyto autorizační
 * atributy neposílá. Guardian route úmyslně nemá @Permission — přístup je
 * relationship-scoped a ověřuje se v ProgressService stejně jako guardian API.
 *
 * Progress obsahuje citlivá a rychle se měnící školní data. Celý controller je
 * proto HTTP no-store: nová kompetence/hodnocení jsou okamžitě viditelné a
 * odpovědi se neukládají do sdílené server/browser cache.
 */
@Controller('progress')
@OrgOperation(OrgOperationType.EXECUTION)
@NoHttpCache()
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('context')
  @Permission(OrganizationRole.TEACHER, OrganizationRole.DIRECTOR)
  context(@Req() req: RequestWithUser) {
    return this.progress.getContext(req.user);
  }

  @Post('competencies')
  @OrgOperation(OrgOperationType.AUTHORING)
  @Permission(OrganizationRole.DIRECTOR)
  createCompetency(
    @Body() dto: CreateCompetencyDto,
    @Req() req: RequestWithUser,
  ) {
    return this.progress.createCompetency(dto, req.user);
  }

  @Post('entries')
  @OrgOperation(OrgOperationType.AUTHORING)
  @Permission(OrganizationRole.TEACHER, OrganizationRole.DIRECTOR)
  createEntry(
    @Body() dto: CreateProgressEntryDto,
    @Req() req: RequestWithUser,
  ) {
    return this.progress.createEntry(dto, req.user);
  }

  @Post('sync')
  @OrgOperation(OrgOperationType.AUTHORING)
  @Permission(OrganizationRole.TEACHER, OrganizationRole.DIRECTOR)
  sync(
    @Body() dto: SyncProgressEntriesDto,
    @Req() req: RequestWithUser,
  ) {
    return this.progress.syncEntries(dto.entries, req.user);
  }

  @Post('attendance')
  @OrgOperation(OrgOperationType.AUTHORING)
  @Permission(OrganizationRole.TEACHER, OrganizationRole.DIRECTOR)
  createAttendance(
    @Body() dto: CreateAttendanceRecordDto,
    @Req() req: RequestWithUser,
  ) {
    return this.progress.createAttendance(dto, req.user);
  }

  @Post('interventions')
  @OrgOperation(OrgOperationType.AUTHORING)
  @Permission(OrganizationRole.TEACHER, OrganizationRole.DIRECTOR)
  createIntervention(
    @Body() dto: CreateInterventionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.progress.createIntervention(dto, req.user);
  }

  @Patch('interventions/:interventionId/resolve')
  @OrgOperation(OrgOperationType.AUTHORING)
  @Permission(OrganizationRole.TEACHER, OrganizationRole.DIRECTOR)
  resolveIntervention(
    @Param('interventionId', new ParseUUIDPipe()) interventionId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.progress.resolveIntervention(interventionId, req.user);
  }

  @Get('students/:studentId')
  @Permission(OrganizationRole.TEACHER, OrganizationRole.DIRECTOR)
  studentDetail(
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.progress.getStudentDetail(studentId, req.user);
  }

  @Get('guardian/students/:studentId')
  guardianStudentDetail(
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.progress.getGuardianStudentDetail(studentId, req.user);
  }

  @Get('dashboard')
  @Permission(OrganizationRole.DIRECTOR)
  schoolDashboard(@Req() req: RequestWithUser) {
    return this.progress.getSchoolDashboard(req.user);
  }

  @Get('dashboard/classes/:classSectionId')
  @Permission(OrganizationRole.TEACHER, OrganizationRole.DIRECTOR)
  classDashboard(
    @Param('classSectionId', new ParseUUIDPipe()) classSectionId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.progress.getClassDashboard(classSectionId, req.user);
  }
}
