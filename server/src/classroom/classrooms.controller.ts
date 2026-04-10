// YEAR-SCOPED: Uses selected academic year from query params.
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { Throttle } from '@nestjs/throttler';
import { PermissionKey } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { ok } from '@/common/http/envelope';
import { RequestWithUser } from '@/types/request-with-user';
import { ClassSectionsService } from './class-sections.service';
import { CreateClassSectionDto } from './dto/create-classroom.dto';
import { QueryClassSectionsDto } from './dto/query-class-sections.dto';
import { AllowPendingOrg } from '@/common/decorators/allow-pending-org.decorator';
import { OrgOperation, OrgOperationType } from '@/common/decorators/org-operation.decorator';
import { OrgContextService } from '@/common/org-context/org-context.service';
import { AcademicYearExpiredGuard } from '@/academic-years/academic-year-expired.guard';

@ApiTags('Classrooms')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('classrooms')
@OrgOperation(OrgOperationType.AUTHORING)
@AllowPendingOrg()
export class ClassroomsController {
  constructor(
    private readonly service: ClassSectionsService,
    private readonly orgContext: OrgContextService,
  ) {}

  @Get()
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'List classrooms by academic year' })
  @CacheTTL(0)
  async list(@Req() req: RequestWithUser, @Query() q: QueryClassSectionsDto) {
    const ctx = await this.orgContext.get(req);
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException('Missing active academic year');
    }
    if (q.yearId && q.academicYearId && q.yearId !== q.academicYearId) {
      throw new BadRequestException('academicYearId a yearId se musí shodovat.');
    }
    const requestedYearId = q.yearId ?? q.academicYearId ?? ctx.activeAcademicYearId;
    return ok(
      this.service.findAll(
        {
          ...q,
          yearId: requestedYearId,
          academicYearId: requestedYearId,
        },
        req.user,
      ),
    );
  }

  @Get('my-structure')
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS)
  @CacheTTL(0)
  @ApiOperation({ summary: 'Get structured classroom view for current user (homeroom / teaching / other)' })
  async myStructure(@Req() req: RequestWithUser) {
    const ctx = await this.orgContext.get(req);
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException('Missing active academic year');
    }
    return ok(this.service.getMyStructure(req.user, ctx.activeAcademicYearId));
  }

  @Get(':id/risk-overview')
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @CacheTTL(0)
  @ApiOperation({ summary: 'Classroom risk overview (Early Warning Panel)' })
  riskOverview(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('subjectId') subjectId: string | undefined,
    @Query('limit') limitStr: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    const rawLimit = parseInt(String(limitStr ?? '20'), 10) || 20;
    const limit = Math.min(100, Math.max(1, rawLimit));
    return ok(this.service.getRiskOverview(id, req.user, subjectId, limit));
  }

  @Get(':id/subject-performance')
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS)
  @CacheTTL(0)
  @ApiOperation({ summary: 'Subject performance summary for classroom' })
  async subjectPerformance(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Query('limit') limitStr: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    const rawLimit = parseInt(String(limitStr ?? '20'), 10) || 20;
    const limit = Math.min(100, Math.max(1, rawLimit));
    const ctx = await this.orgContext.get(req);
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException('Missing active academic year');
    }
    if (academicYearId && academicYearId !== ctx.activeAcademicYearId) {
      throw new BadRequestException('academicYearId query is not allowed');
    }
    return ok(this.service.getSubjectPerformance(id, req.user, ctx.activeAcademicYearId, limit));
  }

  @Get(':id')
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS)
  @CacheTTL(0)
  @ApiOperation({ summary: 'Classroom detail' })
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.findOne(id, req.user));
  }

  @Post()
  @UseGuards(AcademicYearExpiredGuard)
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Create classroom for academic year' })
  async create(@Body() dto: CreateClassSectionDto, @Req() req: RequestWithUser) {
    const ctx = await this.orgContext.get(req);
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException('Missing active academic year');
    }
    if (
      (dto.yearId && dto.yearId !== ctx.activeAcademicYearId) ||
      (dto.academicYearId && dto.academicYearId !== ctx.activeAcademicYearId)
    ) {
      throw new BadRequestException('yearId/academicYearId body is not allowed');
    }
    return ok(
      this.service.create(
        {
          ...dto,
          yearId: ctx.activeAcademicYearId,
          academicYearId: ctx.activeAcademicYearId,
        },
        req.user,
      ),
    );
  }
}
