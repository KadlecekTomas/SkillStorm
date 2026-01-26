import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RequestWithUser } from '@/types/request-with-user';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { MembershipsService } from './memberships.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { QueryMembershipsDto } from './dto/query-memberships.dto';
import { CacheTTL } from '@nestjs/cache-manager';
import { InvalidateScopes } from '@/common/cache/invalidate.decorator';
import { Permission } from '@/modules/rbac/permission.decorator';

@ApiTags('memberships')
@ApiBearerAuth()
@Controller('memberships')
export class MembershipsController {
  constructor(private readonly service: MembershipsService) {}

  // CREATE
  @Post()
  @ApiOperation({
    summary: 'Add user to organization (SUPERADMIN or DIRECTOR)',
  })
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.OWNER, OrganizationRole.DIRECTOR)
  @InvalidateScopes(({ req }) => [req.body?.organizationId].filter(Boolean))
  async create(@Body() dto: CreateMembershipDto, @Req() req: RequestWithUser) {
    // org‑scope kontrola probíhá v service (effectiveOrgId)
    return this.service.create(dto, req.user);
  }

  // LIST (org-scoped)
  @Get()
  @ApiOperation({
    summary:
      'List organization members (SUPERADMIN or DIRECTOR) + search/pagination',
  })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.OWNER, OrganizationRole.DIRECTOR)
  @CacheTTL(0)
  async findAll(@Query() q: QueryMembershipsDto, @Req() req: RequestWithUser) {
    return this.service.findAll(req.user, q);
  }

  // UPDATE
  @Patch(':id')
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.OWNER, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Update role of member (SUPERADMIN or DIRECTOR)' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMembershipDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.update(id, dto, req.user);
  }

  // DELETE
  @Delete(':id')
  @ApiOperation({
    summary: 'Remove user from organization (SUPERADMIN or DIRECTOR)',
  })
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.OWNER, OrganizationRole.DIRECTOR)
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.remove(id, req.user);
  }
}
