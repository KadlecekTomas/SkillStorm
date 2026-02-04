// YEAR-SCOPED: Requires active academic year (RequireActiveAcademicYearGuard)
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
import { PermissionKey } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { ok } from '@/common/http/envelope';
import { RequestWithUser } from '@/types/request-with-user';
import { ClassSectionsService } from './class-sections.service';
import { CreateClassSectionDto } from './dto/create-classroom.dto';
import { QueryClassSectionsDto } from './dto/query-class-sections.dto';
import { UseGuards } from '@nestjs/common';
import { RequireActiveAcademicYearGuard } from '@/academic-years/require-active-academic-year.guard';
import { AllowPendingOrg } from '@/common/decorators/allow-pending-org.decorator';

@ApiTags('Classrooms')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('classrooms')
@UseGuards(RequireActiveAcademicYearGuard)
export class ClassroomsController {
  constructor(private readonly service: ClassSectionsService) {}

  @Get()
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'List classrooms by academic year' })
  list(@Req() req: RequestWithUser, @Query() q: QueryClassSectionsDto) {
    return ok(this.service.findAll(q, req.user));
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
