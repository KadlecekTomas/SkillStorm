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
} from '@nestjs/common';
import { RequestWithUser } from '@/types/request-with-user';
import { PermissionKey, OrganizationRole } from '@prisma/client';
import { CreateAssignmentDto, UpdateAssignmentDto } from './dto';
import { AssignmentsService } from './assignments.service';
import { Permission } from '@/modules/rbac/permission.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { MyAssignmentDto } from './my-assignments.dto';

@ApiTags('assignments')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Create assignment' })
  create(
    @Body() dto: CreateAssignmentDto,
    @Req() req: RequestWithUser,
  ) {
    if (
      dto.organizationId &&
      dto.organizationId !== req?.user?.organizationId &&
      req?.user?.systemRole !== 'SUPERADMIN'
    ) {
      throw new ForbiddenException('Invalid org scope');
    }
    return ok(this.assignmentsService.create(dto));
  }

  @Get('my')
  @Permission(
    OrganizationRole.STUDENT,
    OrganizationRole.TEACHER,
    OrganizationRole.DIRECTOR,
  )
  @ApiOperation({ summary: 'List assignments for current user (student scope)' })
  async myAssignments(
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; data?: MyAssignmentDto[]; error?: string }> {
    const data = await this.assignmentsService.listForUser(req.user);
    return ok(data);
  }

  @Get(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS, OrganizationRole.STUDENT)
  @ApiOperation({ summary: 'Get assignment detail' })
  async findOne(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    const assignment = await this.assignmentsService.findOneOrThrow(id);

    // STUDENT: může jen ve své organizaci
    if (req.user.organizationRole === 'STUDENT') {
      if (assignment.organizationId !== req.user.organizationId) {
        throw new ForbiddenException('Access denied');
      }
    }

    // Učitel/Direktor: RbacGuard + JWT claim drží scope organizace
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
    if (assignment.organizationId !== req.user.organizationId) {
      throw new ForbiddenException('Access denied');
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
    if (assignment.organizationId !== req.user.organizationId) {
      throw new ForbiddenException('Access denied');
    }
    return ok(this.assignmentsService.remove(id));
  }
}
