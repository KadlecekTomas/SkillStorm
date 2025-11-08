import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permission } from 'src/modules/rbac/permission.decorator';
import { PermissionKey } from '@prisma/client';
import {
  CreateSubmissionDto,
  FinishSubmissionDto,
  UpdateSubmissionDto,
} from './dto';
import { SubmissionsService } from './submissions.service';

@Controller('submissions')
@UseGuards(JwtAuthGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @Permission(PermissionKey.VIEW_RESULTS, PermissionKey.MANAGE_STUDENTS)
  create(@Body() dto: CreateSubmissionDto, @Req() req) {
    return this.submissionsService.create(dto, req.user);
  }

  @Patch(':id/responses')
  @Permission(PermissionKey.VIEW_RESULTS, PermissionKey.MANAGE_STUDENTS)
  updateResponses(
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionDto,
    @Req() req,
  ) {
    return this.submissionsService.updateResponses(id, dto, req.user);
  }

  @Post(':id/finish')
  @HttpCode(HttpStatus.OK)
  @Permission(PermissionKey.VIEW_RESULTS, PermissionKey.MANAGE_STUDENTS)
  finish(
    @Param('id') id: string,
    @Body() dto: FinishSubmissionDto,
    @Req() req,
  ) {
    return this.submissionsService.finish(id, dto, req.user);
  }

  @Get()
  @Permission(PermissionKey.VIEW_RESULTS, PermissionKey.MANAGE_STUDENTS)
  findAll(
    @Query('assignmentId') assignmentId: string,
    @Query('studentId') studentId: string,
    @Req() req,
  ) {
    return this.submissionsService.findAll(
      { assignmentId, studentId },
      req.user,
    );
  }

  @Get(':id')
  @Permission(PermissionKey.VIEW_RESULTS, PermissionKey.MANAGE_STUDENTS)
  findOne(@Param('id') id: string, @Req() req) {
    return this.submissionsService.findOne(id, req.user);
  }
}
