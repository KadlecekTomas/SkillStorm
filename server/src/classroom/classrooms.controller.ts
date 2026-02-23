// YEAR-SCOPED: Uses selected academic year from query params.
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Classrooms')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('classrooms')
@OrgOperation(OrgOperationType.AUTHORING)
@AllowPendingOrg()
export class ClassroomsController {
  constructor(private readonly service: ClassSectionsService) {}

  @Get()
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'List classrooms by academic year' })
  list(@Req() req: RequestWithUser, @Query() q: QueryClassSectionsDto) {
    return ok(this.service.findAll(q, req.user));
  }

  @Get(':id/risk-overview')
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Classroom risk overview (Early Warning Panel)' })
  riskOverview(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('subjectId') subjectId: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.getRiskOverview(id, req.user, subjectId));
  }

  @Get(':id/subject-performance')
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'Subject performance summary for classroom' })
  subjectPerformance(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.getSubjectPerformance(id, req.user, academicYearId));
  }

  @Get(':id')
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'Classroom detail' })
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.findOne(id, req.user));
  }

  @Post()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Create classroom for academic year' })
  create(@Body() dto: CreateClassSectionDto, @Req() req: RequestWithUser) {
    return ok(this.service.create(dto, req.user));
  }
}
