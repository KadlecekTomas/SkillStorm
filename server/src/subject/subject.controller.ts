// src/modules/subjects/subjects.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { RequestWithUser } from '@/types/request-with-user';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';

import { SystemRole, OrganizationRole, PermissionKey } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';

import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { QuerySubjectsDto } from './dto/query-subjects.dto';
import { SetActiveSubjectDto } from './dto/set-active-subject.dto';
import { ToggleSubjectLevelDto } from './dto/toggle-subject-level.dto';
import { SubjectsService } from './subject.service';

import { InvalidateScopes } from '@/common/cache/invalidate.decorator';

@ApiTags('Subjects')
@ApiBearerAuth()
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly service: SubjectsService) {}

  // ---------- CREATE ----------
  @Post()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Vytvoření předmětu' })
  @InvalidateScopes(({ req }) => [req.body?.organizationId].filter(Boolean))
  create(@Body() dto: CreateSubjectDto, @Req() req: RequestWithUser) {
    return this.service.create(dto, req.user);
  }

  // ---------- LIST ----------
  @Get()
  @Permission(PermissionKey.VIEW_TEST_OVERVIEW)
  @ApiOperation({
    summary: 'Získat předměty (search, pagination, includeLevels)',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false, example: 'mat' })
  @ApiQuery({ name: 'includeLevels', required: false, example: false })
  @ApiQuery({ name: 'includeInactive', required: false, example: false, description: 'Include inactive subjects' })
  @CacheTTL(0) // čtecí endpointy necacheujeme na HTTP vrstvě – používáme verziovanou cache v service
  findAll(@Req() req: RequestWithUser, @Query() q: QuerySubjectsDto) {
    return this.service.findAll(req.user, q);
  }

  // ---------- DETAIL ----------
  @Get(':id')
  @Permission(PermissionKey.VIEW_TEST_OVERVIEW)
  @ApiOperation({ summary: 'Detail předmětu' })
  @CacheTTL(0)
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.findOne(id, req.user);
  }

  // ---------- UPDATE ----------
  @Patch(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Úprava předmětu' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSubjectDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.update(id, dto, req.user);
  }

  // ---------- ACTIVATE / DEACTIVATE ----------
  @Patch(':id/activation')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({
    summary: 'Activate or deactivate a subject',
    description:
      'Deactivating blocks new test creation for this subject. Existing tests remain untouched. Fully reversible.',
  })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  setActive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetActiveSubjectDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.setActive(id, dto.isActive, req.user);
  }

  // ---------- DELETE (soft) ----------
  @Delete(':id')
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.OWNER, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Soft smazání předmětu' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.remove(id, req.user);
  }

  // ---------- Subject → Levels ----------
  @Get(':id/levels')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Seznam SubjectLevel pro daný předmět' })
  @CacheTTL(0)
  findLevels(
    @Param('id', new ParseUUIDPipe()) subjectId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.findLevels(subjectId, req.user);
  }

  // ---------- SubjectLevel → toggle isEnabled ----------
  @Patch(':id/levels/:grade')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Enable or disable a subject grade level' })
  @InvalidateScopes(({ result }) =>
    result?.subject?.organizationId ? [result.subject.organizationId] : [],
  )
  toggleSubjectLevel(
    @Param('id', new ParseUUIDPipe()) subjectId: string,
    @Param('grade') grade: string,
    @Body() dto: ToggleSubjectLevelDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.toggleSubjectLevel(subjectId, grade, dto.isEnabled, req.user);
  }

  // ---------- Subject → TopicLevels (přes Levels) ----------
  @Get(':id/topics')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({
    summary: 'Všechna TopicLevel pro daný předmět (přes SubjectLevel)',
  })
  @CacheTTL(0)
  findTopicsBySubject(
    @Param('id', new ParseUUIDPipe()) subjectId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.findTopicLevels(subjectId, req.user);
  }
}
