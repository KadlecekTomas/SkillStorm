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
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { $Enums, OrganizationType } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { SchoolAccessGuard } from '../auth/guards/school-access.guard';
import { QueryOrganizationsDto } from './dto/query-organizations.dto';
import { CacheTTL } from '@nestjs/cache-manager';
import { InvalidateScopes } from 'src/common/cache/invalidate.decorator';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Post()
  @ApiOperation({
    summary:
      'Create organization (PRIVATE/COMMUNITY: any user, SCHOOL: superadmin nebo aktuální director)',
  })
  @InvalidateScopes(() => ['ALL']) // globální list → invaliduj ALL
  async create(@Body() dto: CreateOrganizationDto, @Req() req: any) {
    const userId = req.user?.userId;
    const isSuper = req.user?.systemRole === $Enums.SystemRole.SUPERADMIN;

    if (dto.type === OrganizationType.SCHOOL && !isSuper) {
      const isDirectorSomewhere = await this.service.userIsDirector(userId);
      if (!isDirectorSomewhere) {
        throw new ForbiddenException(
          'Školu může vytvořit pouze superadmin nebo uživatel, který je již ředitelem v jiné organizaci.',
        );
      }
    }

    return this.service.create(dto, userId);
  }

  @Get()
  @Roles($Enums.SystemRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Get organizations (only superadmin), s pagination + search',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: OrganizationType })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @CacheTTL(0) // vypnout HTTP response cache – používáme verzovanou cache v service
  findAll(@Query() q: QueryOrganizationsDto) {
    return this.service.findAll(q);
  }

  @Get(':id')
  @UseGuards(SchoolAccessGuard)
  @Roles(
    $Enums.OrganizationRole.DIRECTOR,
    $Enums.OrganizationRole.TEACHER,
    $Enums.OrganizationRole.STUDENT,
    $Enums.SystemRole.SUPERADMIN,
  )
  @ApiOperation({
    summary: 'Get organization detail (director/teacher/student/superadmin)',
  })
  @CacheTTL(0)
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseGuards(SchoolAccessGuard)
  @Roles($Enums.OrganizationRole.DIRECTOR, $Enums.SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update organization (director or superadmin)' })
  @InvalidateScopes(() => ['ALL'])
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: any,
  ) {
    if (
      dto.type === OrganizationType.SCHOOL &&
      req.user?.systemRole !== $Enums.SystemRole.SUPERADMIN
    ) {
      throw new ForbiddenException(
        'Pouze superadmin může změnit typ organizace na SCHOOL.',
      );
    }
    return this.service.update(id, dto, req.user?.userId ?? null);
  }

  @Delete(':id')
  @Roles($Enums.SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Soft delete organization (only for superadmin)' })
  @InvalidateScopes(() => ['ALL'])
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }
}
