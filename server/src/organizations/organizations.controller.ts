// src/modules/organizations/organizations.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ForbiddenException,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { RequestWithUser } from '@/types/request-with-user';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationType, OrganizationRole, SystemRole } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { SchoolAccessGuard } from '@/auth/guards/school-access.guard';
import { QueryOrganizationsDto } from './dto/query-organizations.dto';
import { CacheTTL } from '@nestjs/cache-manager';
import { InvalidateScopes } from '@/common/cache/invalidate.decorator';
import { Permission } from '@/modules/rbac/permission.decorator';
import { ok } from '@/common/http/envelope';
import { AllowAnyOrgStatus } from '@/common/decorators/allow-any-org-status.decorator';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';

@ApiTags('organizations')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Post()
  @AllowAnyOrgStatus()
  @ApiOperation({
    summary:
      'Create organization (SCHOOL: any authenticated user, COMMUNITY: superadmin)',
  })
  @InvalidateScopes(() => ['ALL']) // globální list → invaliduj ALL
  async create(
    @Body() dto: CreateOrganizationDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user?.userId;
    const isSuper = req.user?.systemRole === SystemRole.SUPERADMIN;

    if (dto.type === OrganizationType.COMMUNITY && !isSuper) {
      throw new ForbiddenException(
        'Community organizaci může vytvořit pouze superadmin.',
      );
    }

    if (dto.type === OrganizationType.PRIVATE && !isSuper) {
      throw new ForbiddenException(
        'Private organizaci může vytvořit pouze superadmin.',
      );
    }

    return ok(this.service.create(dto, userId));
  }

  @Get()
  @Permission(SystemRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Get organizations (only superadmin), s pagination + search',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: OrganizationType })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @CacheTTL(0) // vypnout HTTP response cache – používáme verzovanou cache v service
  findAll(@Query() q: QueryOrganizationsDto) {
    return ok(this.service.findAll(q));
  }

  @Get(':id')
  @UseGuards(SchoolAccessGuard)
  @Permission(
    OrganizationRole.OWNER,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
    OrganizationRole.STUDENT,
    SystemRole.SUPERADMIN,
  )
  @ApiOperation({
    summary: 'Get organization detail (director/teacher/student/superadmin)',
  })
  @CacheTTL(0)
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return ok(this.service.findOne(id));
  }

  @Patch(':id')
  @UseGuards(SchoolAccessGuard)
  @Permission(OrganizationRole.OWNER, OrganizationRole.DIRECTOR, SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update organization (director or superadmin)' })
  @InvalidateScopes(() => ['ALL'])
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: RequestWithUser,
  ) {
    if (
      dto.type === OrganizationType.SCHOOL &&
      req.user?.systemRole !== SystemRole.SUPERADMIN
    ) {
      throw new ForbiddenException(
        'Pouze superadmin může změnit typ organizace na SCHOOL.',
      );
    }
    return ok(this.service.update(id, dto, req.user?.userId ?? null));
  }

  @Delete(':id')
  @Permission(SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Soft delete organization (only for superadmin)' })
  @InvalidateScopes(() => ['ALL'])
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return ok(this.service.remove(id));
  }
}
