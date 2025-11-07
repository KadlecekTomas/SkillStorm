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
import { PermissionKey, OrganizationRole } from '@prisma/client';
import { CreateAssignmentDto, UpdateAssignmentDto } from './dto';
import { AssignmentsService } from './assignments.service';
import { Permission } from 'src/modules/rbac/permission.decorator';

@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  create(@Body() dto: CreateAssignmentDto) {
    return this.assignmentsService.create(dto);
  }

  @Get(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS, OrganizationRole.STUDENT)
  async findOne(@Param('id') id: string, @Req() req) {
    const assignment = await this.assignmentsService.findOneOrThrow(id);

    // STUDENT: může jen ve své organizaci
    if (req.user.organizationRole === 'STUDENT') {
      if (assignment.organizationId !== req.user.organizationId) {
        throw new ForbiddenException('Access denied');
      }
    }

    // Učitel/Direktor: RbacGuard + JWT claim drží scope organizace
    return assignment;
  }

  @Patch(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
    @Req() req,
  ) {
    const assignment = await this.assignmentsService.findOneOrThrow(id);
    if (assignment.organizationId !== req.user.organizationId) {
      throw new ForbiddenException('Access denied');
    }
    return this.assignmentsService.update(id, dto);
  }

  @Delete(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  async remove(@Param('id') id: string, @Req() req) {
    const assignment = await this.assignmentsService.findOneOrThrow(id);
    if (assignment.organizationId !== req.user.organizationId) {
      throw new ForbiddenException('Access denied');
    }
    return this.assignmentsService.remove(id);
  }
}
