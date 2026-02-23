import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RequestWithUser } from '@/types/request-with-user';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { OrgSubjectService } from './org-subject.service';
import { CreateOrgSubjectDto } from './dto/create-org-subject.dto';
import { UpdateOrgSubjectDto } from './dto/update-org-subject.dto';
import { QueryOrgSubjectsDto } from './dto/query-org-subjects.dto';

@ApiTags('OrgSubjects')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('org-subjects')
export class OrgSubjectController {
  constructor(private readonly service: OrgSubjectService) {}

  @Post()
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Create org subject (DIRECTOR or SUPERADMIN)' })
  create(@Body() dto: CreateOrgSubjectDto, @Req() req: RequestWithUser) {
    return ok(this.service.create(dto, req.user));
  }

  @Get()
  @ApiOperation({ summary: 'List org subjects (filtered by JWT org, optional ?grade=)' })
  @CacheTTL(0)
  findAll(@Req() req: RequestWithUser, @Query() q: QueryOrgSubjectsDto) {
    return ok(this.service.findAll(req.user, q));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get org subject by id' })
  @CacheTTL(0)
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.findOne(id, req.user));
  }

  @Patch(':id')
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Update org subject' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrgSubjectDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.update(id, dto, req.user));
  }
}
