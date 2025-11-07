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
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';

import { CreateClassSectionDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import { QueryClassSectionsDto } from './dto/query-class-sections.dto';
import { ClassroomService } from './classroom.service';
import { InvalidateScopes } from 'src/common/cache/invalidate.decorator';
import { Permission } from 'src/modules/rbac/permission.decorator';

@ApiTags('Classroom')
@ApiBearerAuth()
@Controller('class-sections')
export class ClassroomController {
  constructor(private readonly classSectionService: ClassroomService) {}

  @Post()
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
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
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
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
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Smazání třídy' })
  @InvalidateScopes(({ result }) => (result?.orgId ? [result.orgId] : []))
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.classSectionService.remove(id, req.user);
  }
}
