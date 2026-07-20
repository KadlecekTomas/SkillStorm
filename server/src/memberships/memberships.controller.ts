import {
  BadRequestException,
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
  GoneException,
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
import { MembershipRolesService } from './membership-roles.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { QueryMembershipsDto } from './dto/query-memberships.dto';
import { CacheTTL } from '@nestjs/cache-manager';
import { InvalidateScopes } from '@/common/cache/invalidate.decorator';
import { Permission } from '@/modules/rbac/permission.decorator';
import {
  OrgOperation,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';

@ApiTags('memberships')
@ApiBearerAuth()
@Controller('memberships')
@OrgOperation(OrgOperationType.AUTHORING)
export class MembershipsController {
  constructor(
    private readonly service: MembershipsService,
    private readonly rolesService: MembershipRolesService,
  ) {}

  // CREATE
  @Post()
  @ApiOperation({
    summary: 'Legacy create disabled (use invite token)',
  })
  @Permission(
    SystemRole.SUPERADMIN,
    OrganizationRole.OWNER,
    OrganizationRole.DIRECTOR,
  )
  @InvalidateScopes(({ req }) => [req.body?.organizationId].filter(Boolean))
  async create(
    @Body() _dto: CreateMembershipDto,
    @Req() _req: RequestWithUser,
  ) {
    throw new GoneException(
      'Legacy membership create disabled. Use invitation token.',
    );
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
  @Permission(
    SystemRole.SUPERADMIN,
    OrganizationRole.OWNER,
    OrganizationRole.DIRECTOR,
  )
  @CacheTTL(0)
  async findAll(@Query() q: QueryMembershipsDto, @Req() req: RequestWithUser) {
    return this.service.findAll(req.user, q);
  }

  // UPDATE
  @Patch(':id')
  @Permission(
    SystemRole.SUPERADMIN,
    OrganizationRole.OWNER,
    OrganizationRole.DIRECTOR,
  )
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

  // MULTI-ROLE (guardian Etapa A)
  @Get(':id/roles')
  @Permission(
    SystemRole.SUPERADMIN,
    OrganizationRole.OWNER,
    OrganizationRole.DIRECTOR,
  )
  @ApiOperation({ summary: 'List active role assignments of a membership' })
  async listRoles(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.rolesService.listActiveRolesFor(id, req.user);
  }

  @Post(':id/roles')
  @Permission(
    SystemRole.SUPERADMIN,
    OrganizationRole.OWNER,
    OrganizationRole.DIRECTOR,
  )
  @ApiOperation({
    summary:
      'Assign an additional role to a membership (multi-role; STUDENT is exclusive)',
  })
  async assignRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignRoleDto,
    @Req() req: RequestWithUser,
  ) {
    return this.rolesService.assignRole({
      membershipId: id,
      role: dto.role,
      actor: req.user,
    });
  }

  @Delete(':id/roles/:role')
  @Permission(
    SystemRole.SUPERADMIN,
    OrganizationRole.OWNER,
    OrganizationRole.DIRECTOR,
  )
  @ApiOperation({
    summary:
      'Revoke a non-primary role from a membership (takes effect on next request)',
  })
  async revokeRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('role') role: string,
    @Req() req: RequestWithUser,
  ) {
    if (
      !Object.values(OrganizationRole).includes(role as OrganizationRole)
    ) {
      throw new BadRequestException(`Neznámá role: ${role}`);
    }
    return this.rolesService.revokeRole({
      membershipId: id,
      role: role as OrganizationRole,
      actor: req.user,
    });
  }

  // DELETE
  @Delete(':id')
  @ApiOperation({
    summary: 'Remove user from organization (SUPERADMIN or DIRECTOR)',
  })
  @Permission(
    SystemRole.SUPERADMIN,
    OrganizationRole.OWNER,
    OrganizationRole.DIRECTOR,
  )
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
