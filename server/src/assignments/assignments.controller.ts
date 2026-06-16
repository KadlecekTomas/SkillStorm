// YEAR-SCOPED: Requires current academic year (RequireCurrentAcademicYearGuard)
// src/assignments/assignments.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  ForbiddenException,
  BadRequestException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { RequestWithUser } from '@/types/request-with-user';
import { PermissionKey } from '@prisma/client';
import { CreateAssignmentDto, UpdateAssignmentDto } from './dto';
import { AssignmentsService } from './assignments.service';
import { Permission } from '@/modules/rbac/permission.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { MyAssignmentDto } from './my-assignments.dto';
import { RequireCurrentAcademicYearGuard } from '@/academic-years/require-current-academic-year.guard';
import { AcademicYearExpiredGuard } from '@/academic-years/academic-year-expired.guard';
import {
  OrgOperation,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';
import { OrgContextService } from '@/common/org-context/org-context.service';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';

@ApiTags('assignments')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('assignments')
@OrgOperation(OrgOperationType.EXECUTION)
@UseGuards(RequireCurrentAcademicYearGuard, AcademicYearExpiredGuard)
export class AssignmentsController {
  private readonly logger = new Logger(AssignmentsController.name);
  constructor(
    private readonly assignmentsService: AssignmentsService,
    private readonly orgContext: OrgContextService,
  ) {}

  @Post()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Create assignment' })
  async create(@Body() dto: CreateAssignmentDto, @Req() req: RequestWithUser) {
    const ctx = await this.orgContext.get(req);
    if (!ctx.activeAcademicYearId) {
      throw new ForbiddenException('Missing active academic year.');
    }

    if (dto.organizationId && dto.organizationId !== ctx.organizationId) {
      throw new BadRequestException(
        'organizationId in request body is not allowed for this endpoint.',
      );
    }
    if (dto.academicYearId && dto.academicYearId !== ctx.activeAcademicYearId) {
      throw new BadRequestException(
        'academicYearId in request body is not allowed for this endpoint.',
      );
    }

    const assignment = await this.assignmentsService.create(
      {
        ...dto,
        organizationId: ctx.organizationId,
        academicYearId: ctx.activeAcademicYearId,
        createdById: ctx.membershipId,
      },
      ctx,
    );
    const requestId = (req as RequestWithUser & { requestId?: string })
      .requestId;
    if (requestId) {
      this.logger.log(
        JSON.stringify({
          event: 'assignment_create',
          assignmentId: assignment.id,
          organizationId: dto.organizationId,
          requestId,
        }),
      );
    }
    return ok(assignment);
  }

  @Get('my')
  @Permission(
    PermissionKey.VIEW_OWN_ASSIGNMENTS,
    PermissionKey.VIEW_CLASS_ASSIGNMENTS,
    PermissionKey.VIEW_ORG_ASSIGNMENTS,
  )
  @NoHttpCache()
  @ApiOperation({
    summary: 'List assignments for current user (permission-scoped)',
  })
  async myAssignments(
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; data?: MyAssignmentDto[]; error?: string }> {
    const ctx = await this.orgContext.get(req);
    const data = await this.assignmentsService.listForUser(req.user, ctx);
    return ok(data);
  }

  @Get('overview')
  @Permission(PermissionKey.VIEW_OWN_ASSIGNMENTS)
  @NoHttpCache()
  @ApiOperation({
    summary:
      'Student assignment overview bucketed by status (active/upcoming/closedUnsubmitted/completed)',
  })
  async overview(@Req() req: RequestWithUser) {
    const ctx = await this.orgContext.get(req);
    const data = await this.assignmentsService.getStudentOverview(
      ctx.membershipId,
      ctx.organizationId,
      ctx.activeAcademicYearId,
    );
    return ok(data);
  }

  @Get(':assignmentId/test-session')
  @Permission(PermissionKey.VIEW_OWN_ASSIGNMENTS)
  @NoHttpCache()
  @ApiOperation({
    summary:
      'Bootstrap a distraction-free test session: resume or start an attempt and return the sanitized test (no answer key)',
  })
  async testSession(
    @Param('assignmentId') assignmentId: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    const session = await this.assignmentsService.getOrCreateTestSession(
      assignmentId,
      req.user,
      ctx,
    );
    return ok(session);
  }

  @Get(':id')
  @Permission(
    PermissionKey.VIEW_OWN_ASSIGNMENTS,
    PermissionKey.VIEW_CLASS_ASSIGNMENTS,
    PermissionKey.VIEW_ORG_ASSIGNMENTS,
  )
  @NoHttpCache()
  @ApiOperation({ summary: 'Get assignment detail (permission-scoped)' })
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    const ctx = await this.orgContext.get(req);
    const assignment = await this.assignmentsService.findOneOrThrowScoped(
      id,
      ctx,
    );
    const allowed = await this.assignmentsService.canAccessAssignment(
      assignment,
      req.user.userId,
      ctx.organizationId,
      ctx.membershipId,
    );
    if (!allowed) {
      throw new ForbiddenException('Access denied');
    }
    return ok(assignment);
  }

  @Patch(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Update assignment' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    await this.assignmentsService.findOneOrThrowScoped(id, ctx);
    return ok(this.assignmentsService.update(id, dto, ctx));
  }

  @Delete(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Delete assignment' })
  async remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    const ctx = await this.orgContext.get(req);
    await this.assignmentsService.findOneOrThrowScoped(id, ctx);
    return ok(this.assignmentsService.remove(id, ctx));
  }
}
