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
import { ActivityService } from './activity.service';
import {
  CreateActivityDto,
  CreateActivityVersionDto,
  ProposeActivityCurriculumMappingDto,
  ReviewActivityCurriculumMappingDto,
} from './dto/activity.dto';

@ApiTags('Platform Activities')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('platform/activities')
@AllowAnyOrgStatus()
@UseGuards(JwtAuthGuard, PlatformAccessGuard)
@RequirePlatformAccess(PlatformAccessLevel.MUTATION)
export class ActivityPlatformController {
  constructor(private readonly activities: ActivityService) {}

  @Get()
  @NoHttpCache()
  @ApiOperation({ summary: 'List all global Activity drafts, reviews and releases' })
  list(@Req() req: RequestWithUser) {
    return ok(this.activities.listPlatformActivities(req.user));
  }

  @Get(':activityId')
  @NoHttpCache()
  @ApiOperation({ summary: 'Read one global Activity including unpublished versions' })
  get(
    @Param('activityId', new ParseUUIDPipe()) activityId: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.activities.getPlatformActivity(activityId, req.user));
  }

  @Post()
  @ApiOperation({ summary: 'Create a global Activity shell' })
  create(@Body() dto: CreateActivityDto, @Req() req: RequestWithUser) {
    return ok(this.activities.createGlobalActivity(dto, req.user));
  }

  @Post(':activityId/versions')
  @ApiOperation({ summary: 'Create a global immutable ActivityVersion snapshot' })
  createVersion(
    @Param('activityId', new ParseUUIDPipe()) activityId: string,
    @Body() dto: CreateActivityVersionDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.activities.createVersion(activityId, dto, req.user));
  }

  @Post('versions/:versionId/mappings')
  @ApiOperation({ summary: 'Propose a canonical mapping for global Activity content' })
  proposeMapping(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Body() dto: ProposeActivityCurriculumMappingDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.activities.proposeMapping(versionId, dto, req.user));
  }

  @Post('mappings/:mappingId/review')
  @ApiOperation({ summary: 'Review a global Activity curriculum mapping' })
  reviewMapping(
    @Param('mappingId', new ParseUUIDPipe()) mappingId: string,
    @Body() dto: ReviewActivityCurriculumMappingDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.activities.reviewMapping(mappingId, dto, req.user));
  }

  @Post('versions/:versionId/review')
  @ApiOperation({ summary: 'Submit a global ActivityVersion for publication review' })
  submitReview(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.activities.submitForReview(versionId, req.user));
  }

  @Post('versions/:versionId/publish')
  @ApiOperation({ summary: 'Publish a reviewed global ActivityVersion' })
  publish(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.activities.publish(versionId, req.user));
  }

  @Post('versions/:versionId/retire')
  @ApiOperation({ summary: 'Retire a global ActivityVersion without deleting history' })
  retire(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.activities.retire(versionId, req.user));
  }
}
