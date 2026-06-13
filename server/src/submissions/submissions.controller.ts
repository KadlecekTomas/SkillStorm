// YEAR-SCOPED: Requires current academic year (RequireCurrentAcademicYearGuard)
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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { RequireCurrentAcademicYearGuard } from '@/academic-years/require-current-academic-year.guard';
import {
  OrgOperation,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';
import { OrgContextService } from '@/common/org-context/org-context.service';

@ApiTags('submissions')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('submissions')
@OrgOperation(OrgOperationType.EXECUTION)
@UseGuards(JwtAuthGuard, RequireCurrentAcademicYearGuard)
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly orgContext: OrgContextService,
  ) {}

  @Post()
  @Permission(OrganizationRole.STUDENT)
  async create(@Body() dto: CreateSubmissionDto, @Req() req: RequestWithUser) {
    const ctx = await this.orgContext.get(req);
    return ok(this.submissionsService.create(dto, req.user, ctx));
  }

  @Patch(':id/responses')
  @Permission(OrganizationRole.STUDENT)
  async updateResponses(
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return this.submissionsService.updateResponses(id, dto, req.user, ctx);
  }

  @Post(':id/finish')
  @HttpCode(HttpStatus.OK)
  @Permission(OrganizationRole.STUDENT)
  async finish(
    @Param('id') id: string,
    @Body() dto: FinishSubmissionDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.submissionsService.finish(id, dto, req.user, ctx));
  }

  @Get()
  @Permission(PermissionKey.VIEW_RESULTS, PermissionKey.MANAGE_STUDENTS)
  async findAll(
    @Req() req: RequestWithUser,
    @Query('assignmentId') assignmentId: string,
    @Query('studentId') studentId: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const page = Math.max(1, parseInt(String(pageStr ?? '1'), 10) || 1);
    const rawLimit = parseInt(String(limitStr ?? '50'), 10) || 50;
    const limit = Math.min(100, Math.max(1, rawLimit));
    const ctx = await this.orgContext.get(req);
    return ok(
      this.submissionsService.findAll(
        { assignmentId, studentId },
        req.user,
        ctx,
        { page, limit },
      ),
    );
  }

  @Get(':id')
  @Permission(
    OrganizationRole.STUDENT,
    PermissionKey.VIEW_RESULTS,
    PermissionKey.MANAGE_STUDENTS,
  )
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    const ctx = await this.orgContext.get(req);
    return ok(this.submissionsService.findOne(id, req.user, ctx));
  }
}
