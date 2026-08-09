import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import { AllowAnyOrgStatus } from '@/common/decorators/allow-any-org-status.decorator';
import {
  PlatformAccessLevel,
  RequirePlatformAccess,
} from '@/common/decorators/platform-access.decorator';
import { PlatformAccessGuard } from '@/common/guards/platform-access.guard';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { ok } from '@/common/http/envelope';
import type { RequestWithUser } from '@/types/request-with-user';
import {
  CreateLessonExperienceDto,
  CreateLessonExperienceVersionDto,
  ProposeLessonCurriculumMappingDto,
  ReviewLessonCurriculumMappingDto,
} from './dto/lesson-experience.dto';
import { LessonExperienceService } from './lesson-experience.service';

@ApiTags('Platform Lesson Experiences')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('platform/lesson-experiences')
@AllowAnyOrgStatus()
@UseGuards(JwtAuthGuard, PlatformAccessGuard)
@RequirePlatformAccess(PlatformAccessLevel.MUTATION)
export class LessonExperiencePlatformController {
  constructor(private readonly lessons: LessonExperienceService) {}

  @Get()
  @NoHttpCache()
  @ApiOperation({ summary: 'List all global Lesson Experience drafts, reviews and releases' })
  list(@Req() req: RequestWithUser) {
    return ok(this.lessons.listPlatform(req.user));
  }

  @Get(':lessonId')
  @NoHttpCache()
  @ApiOperation({ summary: 'Read one global Lesson Experience including unpublished versions' })
  get(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.lessons.getPlatformLesson(lessonId, req.user));
  }

  @Post()
  @ApiOperation({ summary: 'Create a global Lesson Experience shell' })
  create(@Body() dto: CreateLessonExperienceDto, @Req() req: RequestWithUser) {
    return ok(this.lessons.createGlobalLesson(dto, req.user));
  }

  @Post(':lessonId/versions')
  @ApiOperation({ summary: 'Create and seal a global Lesson Experience version' })
  createVersion(
    @Param('lessonId', new ParseUUIDPipe()) lessonId: string,
    @Body() dto: CreateLessonExperienceVersionDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.lessons.createVersion(lessonId, dto, req.user));
  }

  @Post('versions/:versionId/mappings')
  @ApiOperation({ summary: 'Propose canonical mapping for global Lesson Experience' })
  proposeMapping(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Body() dto: ProposeLessonCurriculumMappingDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.lessons.proposeMapping(versionId, dto, req.user));
  }

  @Post('mappings/:mappingId/review')
  @ApiOperation({ summary: 'Review a global Lesson Experience curriculum mapping' })
  reviewMapping(
    @Param('mappingId', new ParseUUIDPipe()) mappingId: string,
    @Body() dto: ReviewLessonCurriculumMappingDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.lessons.reviewMapping(mappingId, dto, req.user));
  }

  @Post('versions/:versionId/review')
  @ApiOperation({ summary: 'Submit a global Lesson Experience for review' })
  submitForReview(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.lessons.submitForReview(versionId, req.user));
  }

  @Post('versions/:versionId/publish')
  @ApiOperation({ summary: 'Publish a reviewed global Lesson Experience' })
  publish(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.lessons.publish(versionId, req.user));
  }

  @Post('versions/:versionId/retire')
  @ApiOperation({ summary: 'Retire a global Lesson Experience release' })
  retire(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.lessons.retire(versionId, req.user));
  }
}
