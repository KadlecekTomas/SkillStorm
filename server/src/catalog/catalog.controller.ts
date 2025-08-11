import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { OrganizationRole, SystemRole } from '@prisma/client';

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
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  // ---------- READ (teacher/director/superadmin) ----------
  @Get('subjects')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
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
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'CatalogSubject detail (cached)' })
  getSubject(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getSubject(id);
  }

  @Get('subjects/:id/topics')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
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
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'CatalogTopic detail (cached)' })
  getTopic(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getTopic(id);
  }

  // ---------- MATERIALIZE (teacher/director in org, or superadmin) ----------
  @Post('subjects/:id/materialize-to-org')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Vytvoř Subject (+levels) v org z CatalogSubject' })
  materializeSubject(
    @Param('id', new ParseUUIDPipe()) catalogSubjectId: string,
    @Body() dto: MaterializeSubjectDto,
    @Request() req,
  ) {
    return this.service.materializeSubject(catalogSubjectId, dto, req.user);
  }

  @Post('topics/:id/materialize-to-subject-level')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Vytvoř TopicLevel v SubjectLevel z CatalogTopic' })
  materializeTopic(
    @Param('id', new ParseUUIDPipe()) catalogTopicId: string,
    @Body() dto: MaterializeTopicDto,
    @Request() req,
  ) {
    return this.service.materializeTopic(catalogTopicId, dto, req.user);
  }

  @Post('subjects/:id/materialize-topics')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({
    summary: 'Bulk materializace více CatalogTopic do SubjectLevel',
  })
  materializeTopicsBulk(
    @Param('id', new ParseUUIDPipe()) catalogSubjectId: string,
    @Body() dto: MaterializeTopicsBulkDto,
    @Request() req,
  ) {
    return this.service.materializeTopicsBulk(catalogSubjectId, dto, req.user);
  }

  // ---------- CRUD (superadmin only) ----------
  @Post('subjects')
  @Roles(SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Create CatalogSubject (SUPERADMIN)' })
  createCatalogSubject(@Body() dto: CreateCatalogSubjectDto) {
    return this.service.createCatalogSubject(dto);
  }

  @Patch('subjects/:id')
  @Roles(SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update CatalogSubject (SUPERADMIN)' })
  updateCatalogSubject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCatalogSubjectDto,
  ) {
    return this.service.updateCatalogSubject(id, dto);
  }

  @Delete('subjects/:id')
  @Roles(SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Delete CatalogSubject (SUPERADMIN)' })
  deleteCatalogSubject(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.deleteCatalogSubject(id);
  }

  @Post('subjects/:id/topics')
  @Roles(SystemRole.SUPERADMIN)
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
  @Roles(SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update CatalogTopic (SUPERADMIN)' })
  updateCatalogTopic(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCatalogTopicDto,
  ) {
    return this.service.updateCatalogTopic(id, dto);
  }

  @Delete('topics/:id')
  @Roles(SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Delete CatalogTopic (SUPERADMIN)' })
  deleteCatalogTopic(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.deleteCatalogTopic(id);
  }
}
