// src/assignments/assignments.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateAssignmentDto, UpdateAssignmentDto } from './dto';
import { AssignmentsService } from './assignments.service';

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles('TEACHER', 'DIRECTOR')
  create(@Body() dto: CreateAssignmentDto) {
    return this.assignmentsService.create(dto);
  }

  @Get(':id')
  @Roles('TEACHER', 'DIRECTOR', 'STUDENT', 'SUPERADMIN')
  async findOne(@Param('id') id: string, @Req() req) {
    const assignment = await this.assignmentsService.findOneOrThrow(id);

    // STUDENT: může jen ve své organizaci
    if (req.user.organizationRole === 'STUDENT') {
      if (assignment.organizationId !== req.user.organizationId) {
        throw new ForbiddenException('Access denied');
      }
    }

    // Učitel/Direktor: (RolesGuard typicky zajistí org v claimu)
    return assignment;
  }

  @Patch(':id')
  @Roles('TEACHER', 'DIRECTOR')
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
  @Roles('TEACHER', 'DIRECTOR')
  async remove(@Param('id') id: string, @Req() req) {
    const assignment = await this.assignmentsService.findOneOrThrow(id);
    if (assignment.organizationId !== req.user.organizationId) {
      throw new ForbiddenException('Access denied');
    }
    return this.assignmentsService.remove(id);
  }
}
