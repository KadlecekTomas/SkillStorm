import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AllowAnyOrgStatus } from '@/common/decorators/allow-any-org-status.decorator';
import {
  PlatformAccessLevel,
  RequirePlatformAccess,
} from '@/common/decorators/platform-access.decorator';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { PlatformAccessGuard } from '@/common/guards/platform-access.guard';
import type { RequestWithUser } from '@/types/request-with-user';
import { CatalogService } from './catalog.service';
import { PlatformQueryCatalogSubjectsDto } from './dto/platform-query-catalog-subjects.dto';
import { PlatformQueryCatalogTopicsDto } from './dto/platform-query-catalog-topics.dto';
import { PlatformCreateCatalogSubjectDto } from './dto/platform-create-catalog-subject.dto';
import { PlatformUpdateCatalogSubjectDto } from './dto/platform-update-catalog-subject.dto';
import { PlatformCreateCatalogTopicDto } from './dto/platform-create-catalog-topic.dto';
import { PlatformUpdateCatalogTopicDto } from './dto/platform-update-catalog-topic.dto';

@ApiTags('Platform Catalog')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('platform/catalog')
@AllowAnyOrgStatus()
@UseGuards(JwtAuthGuard, PlatformAccessGuard)
@RequirePlatformAccess(PlatformAccessLevel.MUTATION)
export class CatalogPlatformController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('subjects')
  @ApiOperation({ summary: 'List catalog subjects (SUPERADMIN only)' })
  listSubjects(@Query() query: PlatformQueryCatalogSubjectsDto) {
    return ok(this.catalogService.listPlatformSubjects(query));
  }

  @Post('subjects')
  @ApiOperation({ summary: 'Create catalog subject (SUPERADMIN only)' })
  createSubject(
    @Body() dto: PlatformCreateCatalogSubjectDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.catalogService.createPlatformSubject(dto, req.user));
  }

  @Patch('subjects/:id')
  @ApiOperation({ summary: 'Update catalog subject (SUPERADMIN only)' })
  updateSubject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PlatformUpdateCatalogSubjectDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.catalogService.updatePlatformSubject(id, dto, req.user));
  }

  @Delete('subjects/:id')
  @ApiOperation({ summary: 'Delete catalog subject (SUPERADMIN only)' })
  deleteSubject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.catalogService.deletePlatformSubject(id, req.user));
  }

  @Get('topics')
  @ApiOperation({ summary: 'List catalog topics (SUPERADMIN only)' })
  listTopics(@Query() query: PlatformQueryCatalogTopicsDto) {
    return ok(this.catalogService.listPlatformTopics(query));
  }

  @Post('topics')
  @ApiOperation({ summary: 'Create catalog topic (SUPERADMIN only)' })
  createTopic(
    @Body() dto: PlatformCreateCatalogTopicDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.catalogService.createPlatformTopic(dto, req.user));
  }

  @Patch('topics/:id')
  @ApiOperation({ summary: 'Update catalog topic (SUPERADMIN only)' })
  updateTopic(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PlatformUpdateCatalogTopicDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.catalogService.updatePlatformTopic(id, dto, req.user));
  }

  @Delete('topics/:id')
  @ApiOperation({ summary: 'Delete catalog topic (SUPERADMIN only)' })
  deleteTopic(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.catalogService.deletePlatformTopic(id, req.user));
  }
}
