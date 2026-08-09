import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import {
  OrgOperation,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { Permission } from '@/modules/rbac/permission.decorator';
import type { RequestWithUser } from '@/types/request-with-user';
import {
  CreateLessonExperienceDto,
  CreateLessonExperienceVersionDto,
  ProposeLessonCurriculumMappingDto,
  ReviewLessonCurriculumMappingDto,
} from './dto/lesson-experience.dto';
import { LessonExperienceService } from './lesson-experience.service';

const LESSON_AUTHORS = [
  SystemRole.SUPERADMIN,
  OrganizationRole.OWNER,
  OrganizationRole.DIRECTOR,
  OrganizationRole.TEACHER,
] as const;

const LESSON_PUBLISHERS = [
  SystemRole.SUPERADMIN,
  OrganizationRole.OWNER,
  OrganizationRole.DIRECTOR,
] as const;

@ApiTags('Lesson Experiences')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('lesson-experiences')
@OrgOperation(OrgOperationType.AUTHORING)
export class LessonExperienceController {
  constructor(private readonly lessons: LessonExperienceService) {}

  @Get()
  @Permission(...LESSON_AUTHORS)
  @NoHttpCache()
  @ApiOperation({ summary: 'List published global and organization-local Lesson Experiences' })
  list(@Req() req: RequestWithUser) {
    return this.lessons.listAvailable(req.user);
  }

  @Post()
  @Permission(...LESSON_AUTHORS)
  @ApiOperation({ summary: 'Create an organization-scoped Lesson Experience shell' })
  create(@Body() dto: CreateLessonExperienceDto, @Req() req: RequestWithUser) {
    return this.lessons.createOrganizationLesson(dto, req.user);
  }

  @Get(':lessonId')
  @Permission(...LESSON_AUTHORS)
  @NoHttpCache()
  @ApiOperation({ summary: 'Read one visible Lesson Experience and immutable versions' })
  get(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.lessons.getLesson(lessonId, req.user);
  }

  @Post(':lessonId/versions')
  @Permission(...LESSON_AUTHORS)
  @ApiOperation({ summary: 'Create and seal a complete immutable Lesson Experience version' })
  createVersion(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Body() dto: CreateLessonExperienceVersionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.lessons.createVersion(lessonId, dto, req.user);
  }

  @Post('versions/:versionId/mappings')
  @Permission(...LESSON_AUTHORS)
  @ApiOperation({ summary: 'Propose Lesson Experience → canonical outcome/aspect mapping' })
  proposeMapping(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Body() dto: ProposeLessonCurriculumMappingDto,
    @Req() req: RequestWithUser,
  ) {
    return this.lessons.proposeMapping(versionId, dto, req.user);
  }

  @Post('mappings/:mappingId/review')
  @Permission(...LESSON_PUBLISHERS)
  @ApiOperation({ summary: 'Approve or reject a Lesson Experience curriculum mapping' })
  reviewMapping(
    @Param('mappingId', new ParseUUIDPipe()) mappingId: string,
    @Body() dto: ReviewLessonCurriculumMappingDto,
    @Req() req: RequestWithUser,
  ) {
    return this.lessons.reviewMapping(mappingId, dto, req.user);
  }

  @Post('versions/:versionId/review')
  @Permission(...LESSON_AUTHORS)
  @ApiOperation({ summary: 'Submit a sealed Lesson Experience version for review' })
  submitForReview(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.lessons.submitForReview(versionId, req.user);
  }

  @Post('versions/:versionId/publish')
  @Permission(...LESSON_PUBLISHERS)
  @ApiOperation({ summary: 'Publish a reviewed Lesson Experience version' })
  publish(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.lessons.publish(versionId, req.user);
  }

  @Post('versions/:versionId/retire')
  @Permission(...LESSON_PUBLISHERS)
  @ApiOperation({ summary: 'Retire a published Lesson Experience without deleting history' })
  retire(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.lessons.retire(versionId, req.user);
  }
}
