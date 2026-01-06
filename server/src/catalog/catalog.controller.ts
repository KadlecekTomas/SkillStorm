import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RequestWithUser } from '@/types/request-with-user';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SystemRole, PermissionKey } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';

import { QueryCatalogDto } from './dto/query-catalog.dto';
import { CreateCatalogSubjectDto } from './dto/create-catalog-subject.dto';
import { UpdateCatalogSubjectDto } from './dto/update-catalog-subject.dto';
import { CreateCatalogTopicDto } from './dto/create-catalog-topic.dto';
import { UpdateCatalogTopicDto } from './dto/update-catalog-topic.dto';
import { MaterializeSubjectDto } from './dto/materialize-subject.dto';
import { MaterializeTopicDto } from './dto/materialize-topic.dto';
import { MaterializeTopicsBulkDto } from './dto/materialize-topics-bulk.dto';
import { CatalogService } from './catalog.service';

@ApiTags('Catalog')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  // ---------- READ (teacher/director/superadmin) ----------
  @Get('subjects')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({
    summary: 'CatalogSubject list (search + pagination, cached)',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  listSubjects(@Query() q: QueryCatalogDto) {
    return this.service.listSubjects(q);
  }

  @Get('subjects/:id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'CatalogSubject detail (cached)' })
  getSubject(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getSubject(id);
  }

  @Get('subjects/:id/topics')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'CatalogTopic list by CatalogSubject (cached)' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  listTopics(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() q: QueryCatalogDto,
  ) {
    return this.service.listTopicsByCatalogSubject(id, q);
  }

  @Get('topics/:id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'CatalogTopic detail (cached)' })
  getTopic(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getTopic(id);
  }

  // ---------- MATERIALIZE (teacher/director in org, or superadmin) ----------
  @Post('subjects/:id/materialize-to-org')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Vytvoř Subject (+levels) v org z CatalogSubject' })
  materializeSubject(
    @Param('id', new ParseUUIDPipe()) catalogSubjectId: string,
    @Body() dto: MaterializeSubjectDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.materializeSubject(catalogSubjectId, dto, req.user);
  }

  @Post('topics/:id/materialize-to-subject-level')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Vytvoř TopicLevel v SubjectLevel z CatalogTopic' })
  materializeTopic(
    @Param('id', new ParseUUIDPipe()) catalogTopicId: string,
    @Body() dto: MaterializeTopicDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.materializeTopic(catalogTopicId, dto, req.user);
  }

  @Post('subjects/:id/materialize-topics')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({
    summary: 'Bulk materializace více CatalogTopic do SubjectLevel',
  })
  materializeTopicsBulk(
    @Param('id', new ParseUUIDPipe()) catalogSubjectId: string,
    @Body() dto: MaterializeTopicsBulkDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.materializeTopicsBulk(catalogSubjectId, dto, req.user);
  }

  // ---------- CRUD (superadmin only) ----------
  @Post('subjects')
  @Permission(SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Create CatalogSubject (SUPERADMIN)' })
  createCatalogSubject(@Body() dto: CreateCatalogSubjectDto) {
    return this.service.createCatalogSubject(dto);
  }

  @Patch('subjects/:id')
  @Permission(SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update CatalogSubject (SUPERADMIN)' })
  updateCatalogSubject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCatalogSubjectDto,
  ) {
    return this.service.updateCatalogSubject(id, dto);
  }

  @Delete('subjects/:id')
  @Permission(SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Delete CatalogSubject (SUPERADMIN)' })
  deleteCatalogSubject(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.deleteCatalogSubject(id);
  }

  @Post('subjects/:id/topics')
  @Permission(SystemRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Create CatalogTopic under CatalogSubject (SUPERADMIN)',
  })
  createCatalogTopic(
    @Param('id', new ParseUUIDPipe()) subjectId: string,
    @Body() dto: CreateCatalogTopicDto,
  ) {
    return this.service.createCatalogTopic(subjectId, dto);
  }

  @Patch('topics/:id')
  @Permission(SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update CatalogTopic (SUPERADMIN)' })
  updateCatalogTopic(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCatalogTopicDto,
  ) {
    return this.service.updateCatalogTopic(id, dto);
  }

  @Delete('topics/:id')
  @Permission(SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Delete CatalogTopic (SUPERADMIN)' })
  deleteCatalogTopic(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.deleteCatalogTopic(id);
  }
}
