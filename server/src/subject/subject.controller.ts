// src/modules/subjects/subjects.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';

import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { SystemRole, OrganizationRole } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';

import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { QuerySubjectsDto } from './dto/query-subjects.dto';
import { SubjectsService } from './subject.service';

import { InvalidateScopes } from 'src/common/cache/invalidate.decorator';

@ApiTags('Subjects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly service: SubjectsService) {}

  // ---------- CREATE ----------
  @Post()
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Vytvoření předmětu' })
  @InvalidateScopes(({ req }) => [req.body?.organizationId].filter(Boolean))
  create(@Body() dto: CreateSubjectDto, @Request() req) {
    return this.service.create(dto, req.user);
  }

  // ---------- LIST ----------
  @Get()
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({
    summary: 'Získat předměty (search, pagination, includeLevels)',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false, example: 'mat' })
  @ApiQuery({ name: 'includeLevels', required: false, example: false })
  @CacheTTL(0) // čtecí endpointy necacheujeme na HTTP vrstvě – používáme verziovanou cache v service
  findAll(@Request() req, @Query() q: QuerySubjectsDto) {
    return this.service.findAll(req.user, q);
  }

  // ---------- DETAIL ----------
  @Get(':id')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Detail předmětu' })
  @CacheTTL(0)
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.service.findOne(id, req.user);
  }

  // ---------- UPDATE ----------
  @Patch(':id')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Úprava předmětu' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSubjectDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user);
  }

  // ---------- DELETE (soft) ----------
  @Delete(':id')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Soft smazání předmětu' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.service.remove(id, req.user);
  }

  // ---------- Subject → Levels ----------
  @Get(':id/levels')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Seznam SubjectLevel pro daný předmět' })
  @CacheTTL(0)
  findLevels(
    @Param('id', new ParseUUIDPipe()) subjectId: string,
    @Request() req,
  ) {
    return this.service.findLevels(subjectId, req.user);
  }

  // ---------- Subject → TopicLevels (přes Levels) ----------
  @Get(':id/topics')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({
    summary: 'Všechna TopicLevel pro daný předmět (přes SubjectLevel)',
  })
  @CacheTTL(0)
  findTopicsBySubject(
    @Param('id', new ParseUUIDPipe()) subjectId: string,
    @Request() req,
  ) {
    return this.service.findTopicLevels(subjectId, req.user);
  }
}
