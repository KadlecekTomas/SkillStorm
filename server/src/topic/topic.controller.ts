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
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TopicsService } from './topic.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { QueryTopicsDto } from './dto/query-topics.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { AssignMaterialsDto } from './dto/assign-materials.dto';
import { AssignTestsDto } from './dto/assign-tests.dto';

@ApiTags('Topics')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('topics')
export class TopicsController {
  constructor(private readonly service: TopicsService) {}

  @Post()
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Vytvoření TopicLevel (téma)' })
  create(@Body() dto: CreateTopicDto, @Request() req) {
    return this.service.create(dto, req.user);
  }

  @Get()
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({
    summary: 'Seznam TopicLevel s filtry (subjectId / subjectLevelId / search)',
  })
  findAll(@Request() req, @Query() q: QueryTopicsDto) {
    return this.service.findAll(req.user, q);
  }

  @Get(':id')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Detail TopicLevel' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Upravit TopicLevel' })
  update(@Param('id') id: string, @Body() dto: UpdateTopicDto, @Request() req) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Smazat TopicLevel' })
  remove(@Param('id') id: string, @Request() req) {
    return this.service.remove(id, req.user);
  }

  @Get('/by-subject/:subjectId')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'TopicLevel podle Subject ID' })
  getBySubject(@Param('subjectId') subjectId: string, @Request() req) {
    return this.service.findBySubjectId(subjectId, req.user);
  }

  @Post(':id/materials')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Přiřadit (bulk) materiály k TopicLevel' })
  assignMaterials(
    @Param('id') topicLevelId: string,
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
  removeMaterial(
    @Param('id') topicLevelId: string,
    @Param('materialId') materialId: string,
    @Request() req,
  ) {
    return this.service.removeMaterial(topicLevelId, materialId, req.user);
  }

  @Post(':id/tests')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Přiřadit (bulk) testy k TopicLevel' })
  assignTests(
    @Param('id') topicLevelId: string,
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
  removeTest(
    @Param('id') topicLevelId: string,
    @Param('testId') testId: string,
    @Request() req,
  ) {
    return this.service.removeTest(topicLevelId, testId, req.user);
  }

  @Get('/catalog/subjects')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'CatalogSubject list (pro picker)' })
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
  listCatalogTopics(
    @Param('id') catalogSubjectId: string,
    @Query('search') search?: string,
  ) {
    return this.service.listCatalogTopics(catalogSubjectId, search);
  }
}
