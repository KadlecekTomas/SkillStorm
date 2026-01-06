import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@/modules/rbac/permission.decorator';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { RequestWithUser } from '@/types/request-with-user';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { QueryEnrollmentsDto } from './dto/query-enrollments.dto';

@ApiTags('Enrollments')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  @Post()
  @Permission(OrganizationRole.DIRECTOR, OrganizationRole.OWNER, SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Create enrollment (student ↔ class section)' })
  create(@Body() dto: CreateEnrollmentDto, @Req() req: RequestWithUser) {
    return ok(this.service.create(dto, req.user));
  }

  @Get()
  @Permission(OrganizationRole.TEACHER, OrganizationRole.STUDENT, SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'List enrollments for a class section' })
  list(@Query() q: QueryEnrollmentsDto, @Req() req: RequestWithUser) {
    return ok(this.service.listByClassSection(q.classSectionId, req.user));
  }

  @Delete(':id')
  @Permission(OrganizationRole.DIRECTOR, OrganizationRole.OWNER, SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Soft delete enrollment (set status=LEFT)' })
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: RequestWithUser) {
    return ok(this.service.softDelete(id, req.user));
  }
}
