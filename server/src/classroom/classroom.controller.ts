// src/modules/class-section/class-section.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { CacheTTL } from '@nestjs/cache-manager';

import { CreateClassSectionDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import { QueryClassSectionsDto } from './dto/query-class-sections.dto';
import { ClassroomService } from './classroom.service';
import { InvalidateScopes } from 'src/common/cache/invalidate.decorator';

@ApiTags('Classroom')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('class-sections')
export class ClassroomController {
  constructor(private readonly classSectionService: ClassroomService) {}

  @Post()
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Vytvoření třídy (class section)' })
  @InvalidateScopes(({ result }) => (result?.orgId ? [result.orgId] : []))
  create(@Body() dto: CreateClassSectionDto, @Request() req) {
    return this.classSectionService.create(dto, req.user);
  }

  @Get()
  @ApiOperation({
    summary:
      'Seznam tříd dle školního roku (volitelně grade/search) s paginací',
  })
  @CacheTTL(0)
  findAll(@Query() q: QueryClassSectionsDto, @Request() req) {
    return this.classSectionService.findAll(q, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail třídy' })
  @CacheTTL(0)
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.classSectionService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Úprava třídy' })
  @InvalidateScopes(({ result }) => (result?.orgId ? [result.orgId] : []))
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateClassroomDto,
    @Request() req,
  ) {
    return this.classSectionService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Smazání třídy' })
  @InvalidateScopes(({ result }) => (result?.orgId ? [result.orgId] : []))
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.classSectionService.remove(id, req.user);
  }
}
