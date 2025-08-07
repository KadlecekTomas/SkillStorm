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
} from '@nestjs/common';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { $Enums } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { SchoolAccessGuard } from '../auth/guards/school-access.guard';

@Controller('organizations')
@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create organization (open for PRIVATE/COMMUNITY users)',
  })
  create(@Body() dto: CreateOrganizationDto, @Req() req) {
    if (dto.type === 'SCHOOL' && req.user.systemRole !== 'SUPERADMIN') {
      throw new ForbiddenException('Pouze superadmin může vytvořit školu.');
    }
    return this.service.create(dto);
  }

  @Get()
  @Roles($Enums.SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get all organizations (only for superadmin)' })
  findAll() {
    return this.service.findAll();
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
    summary: 'Get organization detail (director/teacher/student)',
  })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseGuards(SchoolAccessGuard)
  @Roles($Enums.OrganizationRole.DIRECTOR, $Enums.SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update organization (director or superadmin)' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles($Enums.SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Soft delete organization (only for superadmin)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
