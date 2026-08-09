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
import { ActivityService } from './activity.service';
import {
  CreateActivityDto,
  CreateActivityVersionDto,
  ProposeActivityCurriculumMappingDto,
  ReviewActivityCurriculumMappingDto,
} from './dto/activity.dto';

const ACTIVITY_AUTHORS = [
  SystemRole.SUPERADMIN,
  OrganizationRole.OWNER,
  OrganizationRole.DIRECTOR,
  OrganizationRole.TEACHER,
] as const;

const ACTIVITY_PUBLISHERS = [
  SystemRole.SUPERADMIN,
  OrganizationRole.OWNER,
  OrganizationRole.DIRECTOR,
] as const;

@ApiTags('Activities')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('activities')
@OrgOperation(OrgOperationType.AUTHORING)
export class ActivityController {
  constructor(private readonly activities: ActivityService) {}

  @Get('engines')
  @Permission(...ACTIVITY_AUTHORS)
  @NoHttpCache()
  @ApiOperation({ summary: 'List supported Activity Engine contracts' })
  engines() {
    return this.activities.listEngines();
  }

  @Get()
  @Permission(...ACTIVITY_AUTHORS)
  @NoHttpCache()
  @ApiOperation({ summary: 'List global published and organization-local activities' })
  list(@Req() req: RequestWithUser) {
    return this.activities.listAvailable(req.user);
  }

  @Post()
  @Permission(...ACTIVITY_AUTHORS)
  @ApiOperation({ summary: 'Create an organization-scoped Activity shell' })
  create(@Body() dto: CreateActivityDto, @Req() req: RequestWithUser) {
    return this.activities.createOrganizationActivity(dto, req.user);
  }

  @Get(':activityId')
  @Permission(...ACTIVITY_AUTHORS)
  @NoHttpCache()
  @ApiOperation({ summary: 'Read one visible Activity with immutable versions' })
  get(
    @Param('activityId', new ParseUUIDPipe()) activityId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.activities.getActivity(activityId, req.user);
  }

  @Post(':activityId/versions')
  @Permission(...ACTIVITY_AUTHORS)
  @ApiOperation({ summary: 'Create a new immutable ActivityVersion snapshot' })
  createVersion(
    @Param('activityId', new ParseUUIDPipe()) activityId: string,
    @Body() dto: CreateActivityVersionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.activities.createVersion(activityId, dto, req.user);
  }

  @Post('versions/:versionId/mappings')
  @Permission(...ACTIVITY_AUTHORS)
  @ApiOperation({ summary: 'Propose ActivityVersion → canonical outcome/aspect mapping' })
  proposeMapping(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Body() dto: ProposeActivityCurriculumMappingDto,
    @Req() req: RequestWithUser,
  ) {
    return this.activities.proposeMapping(versionId, dto, req.user);
  }

  @Post('mappings/:mappingId/review')
  @Permission(...ACTIVITY_PUBLISHERS)
  @ApiOperation({ summary: 'Approve or reject an Activity curriculum mapping' })
  reviewMapping(
    @Param('mappingId', new ParseUUIDPipe()) mappingId: string,
    @Body() dto: ReviewActivityCurriculumMappingDto,
    @Req() req: RequestWithUser,
  ) {
    return this.activities.reviewMapping(mappingId, dto, req.user);
  }

  @Post('versions/:versionId/review')
  @Permission(...ACTIVITY_AUTHORS)
  @ApiOperation({ summary: 'Freeze ActivityVersion content and submit for review' })
  submitReview(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.activities.submitForReview(versionId, req.user);
  }

  @Post('versions/:versionId/publish')
  @Permission(...ACTIVITY_PUBLISHERS)
  @ApiOperation({ summary: 'Publish a reviewed ActivityVersion' })
  publish(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.activities.publish(versionId, req.user);
  }

  @Post('versions/:versionId/retire')
  @Permission(...ACTIVITY_PUBLISHERS)
  @ApiOperation({ summary: 'Retire a published ActivityVersion without deleting history' })
  retire(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.activities.retire(versionId, req.user);
  }
}
