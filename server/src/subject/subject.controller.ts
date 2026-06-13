// src/modules/subjects/subjects.controller.ts
import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
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

import { PermissionKey } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';

import { QuerySubjectsDto } from './dto/query-subjects.dto';
import { ToggleSubjectLevelDto } from './dto/toggle-subject-level.dto';
import { SubjectsService } from './subject.service';

import { InvalidateScopes } from '@/common/cache/invalidate.decorator';
import {
  OrgOperation,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';

@ApiTags('Subjects')
@ApiBearerAuth()
@Controller('subjects')
@OrgOperation(OrgOperationType.AUTHORING)
export class SubjectsController {
  constructor(private readonly service: SubjectsService) {}

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
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    example: false,
    description: 'Include inactive subjects',
  })
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
  @InvalidateScopes(({ req }) => [req.user?.organizationId].filter(Boolean))
  toggleSubjectLevel(
    @Param('id', new ParseUUIDPipe()) subjectId: string,
    @Param('grade') grade: string,
    @Body() dto: ToggleSubjectLevelDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.toggleSubjectLevel(
      subjectId,
      grade,
      dto.isEnabled,
      req.user,
    );
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
