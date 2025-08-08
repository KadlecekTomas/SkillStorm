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
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { $Enums } from '@prisma/client';
import { MembershipsService } from './memberships.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { assertSameOrganization } from 'shared/access.utils';

@ApiTags('memberships')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('memberships')
export class MembershipsController {
  constructor(private readonly service: MembershipsService) {}

  @Post()
  @ApiOperation({
    summary: 'Add user to organization (SUPERADMIN or DIRECTOR)',
  })
  @Roles($Enums.SystemRole.SUPERADMIN, $Enums.OrganizationRole.DIRECTOR)
  async create(@Body() dto: CreateMembershipDto, @Req() req) {
    assertSameOrganization(dto.organizationId, req.user, 'členství');
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get organization members (SUPERADMIN or DIRECTOR)',
  })
  @ApiQuery({ name: 'organizationId', required: true })
  @Roles($Enums.SystemRole.SUPERADMIN, $Enums.OrganizationRole.DIRECTOR)
  async findByOrg(
    @Query('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Req() req,
  ) {
    assertSameOrganization(organizationId, req.user, 'seznam členů');
    return this.service.findByOrganization(organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update role of member (SUPERADMIN or DIRECTOR)' })
  @Roles($Enums.SystemRole.SUPERADMIN, $Enums.OrganizationRole.DIRECTOR)
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMembershipDto,
    @Req() req,
  ) {
    const membership = await this.service.findOne(id);
    assertSameOrganization(membership.organizationId, req.user, 'členství');

    // Business restrikce: DIRECTOR smí upravovat jen nereditelé; DIRECTOR nemůže měnit sám sebe.
    const actingIsSuperadmin = req.user.systemRole === 'SUPERADMIN';
    if (!actingIsSuperadmin) {
      if (membership.role === $Enums.OrganizationRole.DIRECTOR) {
        throw new ForbiddenException('Ředitele může upravit pouze SUPERADMIN.');
      }
      if (membership.userId === req.user.sub) {
        throw new ForbiddenException('Nemůžeš měnit vlastní členství.');
      }
    }

    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Remove user from organization (SUPERADMIN or DIRECTOR)',
  })
  @Roles($Enums.SystemRole.SUPERADMIN, $Enums.OrganizationRole.DIRECTOR)
  async remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req) {
    const membership = await this.service.findOne(id);
    assertSameOrganization(membership.organizationId, req.user, 'členství');

    const actingIsSuperadmin = req.user.systemRole === 'SUPERADMIN';
    if (!actingIsSuperadmin) {
      if (membership.role === $Enums.OrganizationRole.DIRECTOR) {
        throw new ForbiddenException('Ředitele může upravit pouze SUPERADMIN.');
      }
      if (membership.userId === req.user.sub) {
        throw new ForbiddenException('Nemůžeš smazat vlastní členství.');
      }
    }

    return this.service.remove(id);
  }
}
