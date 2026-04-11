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
  Header,
} from '@nestjs/common';
import { RequestWithUser } from '@/types/request-with-user';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { InvalidateScopes } from '@/common/cache/invalidate.decorator';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import { OrgOperation, OrgOperationType } from '@/common/decorators/org-operation.decorator';
import { OrgSubjectService } from './org-subject.service';
import { CreateOrgSubjectDto } from './dto/create-org-subject.dto';
import { UpdateOrgSubjectDto } from './dto/update-org-subject.dto';
import { QueryOrgSubjectsDto } from './dto/query-org-subjects.dto';

@ApiTags('OrgSubjects')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('org-subjects')
@OrgOperation(OrgOperationType.AUTHORING)
export class OrgSubjectController {
  constructor(private readonly service: OrgSubjectService) {}

  @Post()
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Create org subject (DIRECTOR or SUPERADMIN)' })
  @InvalidateScopes(({ req }) => [req.user?.organizationId].filter(Boolean))
  create(@Body() dto: CreateOrgSubjectDto, @Req() req: RequestWithUser) {
    return ok(this.service.create(dto, req.user));
  }

  @Get()
  @ApiOperation({ summary: 'List org subjects (filtered by JWT org, optional ?grade=)' })
  @NoHttpCache()
  @CacheTTL(0)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  findAll(@Req() req: RequestWithUser, @Query() q: QueryOrgSubjectsDto) {
    return ok(this.service.findAll(req.user, q));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get org subject by id' })
  @NoHttpCache()
  @CacheTTL(0)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.findOne(id, req.user));
  }

  @Patch(':id')
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Update org subject' })
  @InvalidateScopes(({ req }) => [req.user?.organizationId].filter(Boolean))
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrgSubjectDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.update(id, dto, req.user));
  }
}
