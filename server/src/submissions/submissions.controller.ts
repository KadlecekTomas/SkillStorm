// YEAR-SCOPED: Requires active academic year (RequireActiveAcademicYearGuard)
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
import { RequestWithUser } from '@/types/request-with-user';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { Permission } from '@/modules/rbac/permission.decorator';
import { OrganizationRole, PermissionKey } from '@prisma/client';
import {
  CreateSubmissionDto,
  FinishSubmissionDto,
  UpdateSubmissionDto,
} from './dto';
import { SubmissionsService } from './submissions.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '@/common/http/envelope';
import { ForbiddenException } from '@nestjs/common';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { RequireActiveAcademicYearGuard } from '@/academic-years/require-active-academic-year.guard';

@ApiTags('submissions')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('submissions')
@UseGuards(JwtAuthGuard, RequireActiveAcademicYearGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @Permission(OrganizationRole.STUDENT)
  create(@Body() dto: CreateSubmissionDto, @Req() req: RequestWithUser) {
    return ok(this.submissionsService.create(dto, req.user));
  }

  @Patch(':id/responses')
  @Permission(OrganizationRole.STUDENT)
  updateResponses(
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.submissionsService.updateResponses(id, dto, req.user);
  }

  @Post(':id/finish')
  @HttpCode(HttpStatus.OK)
  @Permission(OrganizationRole.STUDENT)
  finish(
    @Param('id') id: string,
    @Body() dto: FinishSubmissionDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.submissionsService.finish(id, dto, req.user));
  }

  @Get()
  @Permission(PermissionKey.VIEW_RESULTS, PermissionKey.MANAGE_STUDENTS)
  findAll(
    @Query('assignmentId') assignmentId: string,
    @Query('studentId') studentId: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(
      this.submissionsService.findAll(
        { assignmentId, studentId },
        req.user,
      ),
    );
  }

  @Get(':id')
  @Permission(PermissionKey.VIEW_RESULTS, PermissionKey.MANAGE_STUDENTS)
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return ok(this.submissionsService.findOne(id, req.user));
  }
}
