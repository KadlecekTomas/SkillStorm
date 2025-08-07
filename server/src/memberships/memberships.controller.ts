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
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { $Enums } from '@prisma/client';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@Controller('memberships')
@ApiTags('memberships')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class MembershipsController {
  constructor(private readonly service: MembershipsService) { }

  @Post()
  @ApiOperation({
    summary: 'Add user to organization (SUPERADMIN or DIRECTOR)',
  })
  @Roles($Enums.SystemRole.SUPERADMIN, $Enums.OrganizationRole.DIRECTOR)
  async create(@Body() dto: CreateMembershipDto, @Req() req) {
    const isSuperadmin = req.user.systemRole === 'SUPERADMIN';
    const sameOrg = req.user.organizationId === dto.organizationId;

    if (!isSuperadmin && !sameOrg) {
      throw new ForbiddenException(
        'Nemáš oprávnění přidávat členy do jiné organizace.',
      );
    }

    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get organization members (SUPERADMIN or DIRECTOR)',
  })
  @Roles($Enums.SystemRole.SUPERADMIN, $Enums.OrganizationRole.DIRECTOR)
  async findByOrg(@Query('organizationId') orgId: string, @Req() req) {
    const isSuperadmin = req.user.systemRole === 'SUPERADMIN';
    const sameOrg = req.user.organizationId === orgId;

    if (!isSuperadmin && !sameOrg) {
      throw new ForbiddenException(
        'Nemáš oprávnění zobrazit členy jiné organizace.',
      );
    }

    return this.service.findByOrganization(orgId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update role of member (SUPERADMIN or DIRECTOR)' })
  @Roles($Enums.SystemRole.SUPERADMIN, $Enums.OrganizationRole.DIRECTOR)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipDto,
    @Req() req,
  ) {
    const membership = await this.service.findOne(id);
    const isSuperadmin = req.user.systemRole === 'SUPERADMIN';
    const sameOrg = req.user.organizationId === membership.organizationId;

    if (!isSuperadmin && !sameOrg) {
      throw new ForbiddenException(
        'Nemáš oprávnění upravit člena jiné organizace.',
      );
    }

    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Remove user from organization (SUPERADMIN or DIRECTOR)',
  })
  @Roles($Enums.SystemRole.SUPERADMIN, $Enums.OrganizationRole.DIRECTOR)
  async remove(@Param('id') id: string, @Req() req) {
    const membership = await this.service.findOne(id);
    const isSuperadmin = req.user.systemRole === 'SUPERADMIN';
    const sameOrg = req.user.organizationId === membership.organizationId;

    if (!isSuperadmin && !sameOrg) {
      throw new ForbiddenException(
        'Nemáš oprávnění smazat člena jiné organizace.',
      );
    }

    return this.service.remove(id);
  }
}
