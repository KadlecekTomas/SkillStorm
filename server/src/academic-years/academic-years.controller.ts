import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@/modules/rbac/permission.decorator';
import { PermissionKey } from '@prisma/client';
import { RequestWithUser } from '@/types/request-with-user';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { ok } from '@/common/http/envelope';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';

@ApiTags('AcademicYears')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('academic-years')
export class AcademicYearsController {
  constructor(private readonly service: AcademicYearsService) {}

  @Get()
  @Permission(PermissionKey.VIEW_RESULTS, PermissionKey.MANAGE_STUDENTS)
  @ApiOperation({ summary: 'List academic years for organization' })
  list(@Req() req: RequestWithUser) {
    return ok(this.service.list(req.user));
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active academic year for organization' })
  getActive(@Req() req: RequestWithUser) {
    return ok(this.service.getActiveForOrgOrFail(req.user.organizationId ?? null));
  }

  @Post()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Create academic year' })
  create(@Body() dto: CreateAcademicYearDto, @Req() req: RequestWithUser) {
    return ok(this.service.create(dto, req.user));
  }

  @Patch(':id/activate')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Activate academic year for organization' })
  activate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.activate(id, req.user));
  }
}
