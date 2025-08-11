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
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { AuthGuard } from '@nestjs/passport';

import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { OrganizationRole, SystemRole } from '@prisma/client';

import { TopicsService } from './topic.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { QueryTopicsDto } from './dto/query-topics.dto';
import { AssignMaterialsDto } from './dto/assign-materials.dto';
import { AssignTestsDto } from './dto/assign-tests.dto';
import { InvalidateScopes } from 'src/common/cache/invalidate.decorator';

@ApiTags('Topics')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('topics')
export class TopicsController {
  constructor(private readonly service: TopicsService) {}

  // =======================
  // CATALOG (read-only) – DEJ SEM NAHORU, PŘED :id
  // =======================
  @Get('/catalog/subjects')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'CatalogSubject list (pro picker)' })
  @CacheTTL(0)
  listCatalogSubjects() {
    return this.service.listCatalogSubjects();
  }

  @Get('/catalog/subjects/:id/topics')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
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
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'TopicLevel podle Subject ID' })
  @CacheTTL(0)
  getBySubject(
    @Param('subjectId', new ParseUUIDPipe()) subjectId: string,
    @Request() req,
  ) {
    return this.service.findBySubjectId(subjectId, req.user);
  }

  // =======================
  // LIST
  // =======================
  @Get()
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({
    summary: 'Seznam TopicLevel s filtry (subjectId / subjectLevelId / search)',
  })
  @ApiQuery({ name: 'subjectId', required: false, type: String })
  @ApiQuery({ name: 'subjectLevelId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @CacheTTL(0)
  findAll(@Request() req, @Query() q: QueryTopicsDto) {
    return this.service.findAll(req.user, q);
  }

  // =======================
  // CREATE
  // =======================
  @Post()
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Vytvoření TopicLevel (téma)' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  create(@Body() dto: CreateTopicDto, @Request() req) {
    return this.service.create(dto, req.user);
  }

  // =======================
  // DETAIL
  // =======================
  @Get(':id')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Detail TopicLevel' })
  @CacheTTL(0)
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.service.findOne(id, req.user);
  }

  // =======================
  // UPDATE
  // =======================
  @Patch(':id')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Upravit TopicLevel' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTopicDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user);
  }

  // =======================
  // DELETE
  // =======================
  @Delete(':id')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Smazat TopicLevel' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.service.remove(id, req.user);
  }

  // =======================
  // MATERIALS
  // =======================
  @Post(':id/materials')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Přiřadit (bulk) materiály k TopicLevel' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  assignMaterials(
    @Param('id', new ParseUUIDPipe()) topicLevelId: string,
    @Body() dto: AssignMaterialsDto,
    @Request() req,
  ) {
    return this.service.assignMaterials(topicLevelId, dto, req.user);
  }

  @Delete(':id/materials/:materialId')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Odebrat materiál z TopicLevel' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  removeMaterial(
    @Param('id', new ParseUUIDPipe()) topicLevelId: string,
    @Param('materialId', new ParseUUIDPipe()) materialId: string,
    @Request() req,
  ) {
    return this.service.removeMaterial(topicLevelId, materialId, req.user);
  }

  // =======================
  // TESTS
  // =======================
  @Post(':id/tests')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Přiřadit (bulk) testy k TopicLevel' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  assignTests(
    @Param('id', new ParseUUIDPipe()) topicLevelId: string,
    @Body() dto: AssignTestsDto,
    @Request() req,
  ) {
    return this.service.assignTests(topicLevelId, dto, req.user);
  }

  @Delete(':id/tests/:testId')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Odebrat test z TopicLevel' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  removeTest(
    @Param('id', new ParseUUIDPipe()) topicLevelId: string,
    @Param('testId', new ParseUUIDPipe()) testId: string,
    @Request() req,
  ) {
    return this.service.removeTest(topicLevelId, testId, req.user);
  }
}
