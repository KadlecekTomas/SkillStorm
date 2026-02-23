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
  NotFoundException,
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
import { OrgOperation, OrgOperationType } from '@/common/decorators/org-operation.decorator';

@ApiTags('assignments')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('assignments')
@OrgOperation(OrgOperationType.EXECUTION)
@UseGuards(RequireCurrentAcademicYearGuard)
export class AssignmentsController {
  private readonly logger = new Logger(AssignmentsController.name);
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Create assignment' })
  async create(
    @Body() dto: CreateAssignmentDto,
    @Req() req: RequestWithUser,
  ) {
    if (req.user.systemRole !== 'SUPERADMIN') {
      if (!req.user.organizationId) {
        throw new ForbiddenException('Missing organization context.');
      }
      if (dto.organizationId && dto.organizationId !== req.user.organizationId) {
        throw new NotFoundException('Assignment nenalezen');
      }
      dto.organizationId = req.user.organizationId;
    }
    const assignment = await this.assignmentsService.create(dto);
    const requestId = (req as RequestWithUser & { requestId?: string }).requestId;
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
  @ApiOperation({ summary: 'List assignments for current user (permission-scoped)' })
  async myAssignments(
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; data?: MyAssignmentDto[]; error?: string }> {
    const data = await this.assignmentsService.listForUser(req.user);
    return ok(data);
  }

  @Get(':id')
  @Permission(
    PermissionKey.VIEW_OWN_ASSIGNMENTS,
    PermissionKey.VIEW_CLASS_ASSIGNMENTS,
    PermissionKey.VIEW_ORG_ASSIGNMENTS,
  )
  @ApiOperation({ summary: 'Get assignment detail (permission-scoped)' })
  async findOne(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    const assignment = await this.assignmentsService.findOneOrThrow(id);
    if (
      req.user.systemRole !== 'SUPERADMIN' &&
      assignment.organizationId !== (req.user.organizationId ?? null)
    ) {
      throw new NotFoundException('Assignment nenalezen');
    }
    const membershipId = req.user.membershipId;
    const orgId = req.user.organizationId ?? null;
    if (!membershipId || !orgId) {
      throw new ForbiddenException('Access denied');
    }
    const allowed = await this.assignmentsService.canAccessAssignment(
      assignment,
      req.user.userId,
      orgId,
      membershipId,
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
    const assignment = await this.assignmentsService.findOneOrThrow(id);
    if (
      req.user.systemRole !== 'SUPERADMIN' &&
      assignment.organizationId !== (req.user.organizationId ?? null)
    ) {
      throw new NotFoundException('Assignment nenalezen');
    }
    return ok(this.assignmentsService.update(id, dto));
  }

  @Delete(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Delete assignment' })
  async remove(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    const assignment = await this.assignmentsService.findOneOrThrow(id);
    if (
      req.user.systemRole !== 'SUPERADMIN' &&
      assignment.organizationId !== (req.user.organizationId ?? null)
    ) {
      throw new NotFoundException('Assignment nenalezen');
    }
    return ok(this.assignmentsService.remove(id));
  }
}
