// src/modules/topics/topic.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RequestWithUser } from '@/types/request-with-user';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { Permission } from '@/modules/rbac/permission.decorator';
import { PermissionKey } from '@prisma/client';

import { TopicsService } from './topic.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { QueryTopicsDto } from './dto/query-topics.dto';
import { AssignMaterialsDto } from './dto/assign-materials.dto';
import { AssignTestsDto } from './dto/assign-tests.dto';
import { InvalidateScopes } from '@/common/cache/invalidate.decorator';
import {
  OrgOperation,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';

@ApiTags('Topics')
@ApiBearerAuth()
@Controller('topics')
@OrgOperation(OrgOperationType.AUTHORING)
export class TopicsController {
  constructor(private readonly service: TopicsService) {}

  // =======================
  // CATALOG (read-only) – DEJ SEM NAHORU, PŘED :id
  // =======================
  @Get('/catalog/subjects')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'CatalogSubject list (pro picker)' })
  @CacheTTL(0)
  listCatalogSubjects() {
    return this.service.listCatalogSubjects();
  }

  @Get('/catalog/subjects/:id/topics')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'CatalogTopic list by CatalogSubject (pro picker)' })
  @CacheTTL(0)
  listCatalogTopics(
    @Param('id', new ParseUUIDPipe()) catalogSubjectId: string,
    @Query('search') search?: string,
  ) {
    return this.service.listCatalogTopics(catalogSubjectId, search);
  }

  // =======================
  // BY SUBJECT – TAKY PŘED :id
  // =======================
  @Get('/by-subject/:subjectId')
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({ summary: 'TopicLevel podle Subject ID' })
  @CacheTTL(0)
  getBySubject(
    @Param('subjectId', new ParseUUIDPipe()) subjectId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.findBySubjectId(subjectId, req.user);
  }

  // =======================
  // LIST
  // =======================
  @Get()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({
    summary: 'Seznam TopicLevel s filtry (subjectId / subjectLevelId / search)',
  })
  @ApiQuery({ name: 'subjectId', required: false, type: String })
  @ApiQuery({ name: 'subjectLevelId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @CacheTTL(0)
  findAll(@Req() req: RequestWithUser, @Query() q: QueryTopicsDto) {
    return this.service.findAll(req.user, q);
  }

  // =======================
  // CREATE
  // =======================
  @Post()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Vytvoření TopicLevel (téma)' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  create(@Body() dto: CreateTopicDto, @Req() req: RequestWithUser) {
    return this.service.create(dto, req.user);
  }

  // =======================
  // DETAIL
  // =======================
  @Get(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Detail TopicLevel' })
  @CacheTTL(0)
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.findOne(id, req.user);
  }

  // =======================
  // UPDATE
  // =======================
  @Patch(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Upravit TopicLevel' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTopicDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.update(id, dto, req.user);
  }

  // =======================
  // DELETE
  // =======================
  @Delete(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Smazat TopicLevel' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.remove(id, req.user);
  }

  // =======================
  // MATERIALS
  // =======================
  @Post(':id/materials')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Přiřadit (bulk) materiály k TopicLevel' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  assignMaterials(
    @Param('id', new ParseUUIDPipe()) topicLevelId: string,
    @Body() dto: AssignMaterialsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.assignMaterials(topicLevelId, dto, req.user);
  }

  @Delete(':id/materials/:materialId')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Odebrat materiál z TopicLevel' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  removeMaterial(
    @Param('id', new ParseUUIDPipe()) topicLevelId: string,
    @Param('materialId', new ParseUUIDPipe()) materialId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.removeMaterial(topicLevelId, materialId, req.user);
  }

  // =======================
  // TESTS
  // =======================
  @Post(':id/tests')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Přiřadit (bulk) testy k TopicLevel' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  assignTests(
    @Param('id', new ParseUUIDPipe()) topicLevelId: string,
    @Body() dto: AssignTestsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.assignTests(topicLevelId, dto, req.user);
  }

  @Delete(':id/tests/:testId')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Odebrat test z TopicLevel' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  removeTest(
    @Param('id', new ParseUUIDPipe()) topicLevelId: string,
    @Param('testId', new ParseUUIDPipe()) testId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.removeTest(topicLevelId, testId, req.user);
  }
}
