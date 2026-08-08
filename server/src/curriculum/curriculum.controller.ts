import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { CurriculumService } from './curriculum.service';
import {
  CreateCurriculumApplicabilityDto,
  CreateSchoolCurriculumProfileDto,
  CreateSchoolCurriculumVersionDto,
  ProposeSchoolOutcomeMappingDto,
  ResolveCurriculumApplicabilityDto,
  ReviewSchoolOutcomeMappingDto,
} from './dto/curriculum.dto';

const SCHOOL_CURRICULUM_READERS = [
  SystemRole.SUPERADMIN,
  OrganizationRole.OWNER,
  OrganizationRole.DIRECTOR,
  OrganizationRole.TEACHER,
] as const;

const SCHOOL_CURRICULUM_MANAGERS = [
  SystemRole.SUPERADMIN,
  OrganizationRole.OWNER,
  OrganizationRole.DIRECTOR,
] as const;

@ApiTags('Curriculum')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('curriculum')
@OrgOperation(OrgOperationType.AUTHORING)
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get('profiles')
  @Permission(...SCHOOL_CURRICULUM_READERS)
  @NoHttpCache()
  @ApiOperation({ summary: 'List curriculum profiles and versions for active school' })
  listProfiles(@Req() req: RequestWithUser) {
    return this.curriculum.listSchoolProfiles(req.user);
  }

  @Post('profiles')
  @Permission(...SCHOOL_CURRICULUM_MANAGERS)
  @ApiOperation({ summary: 'Create a school curriculum profile' })
  createProfile(
    @Body() dto: CreateSchoolCurriculumProfileDto,
    @Req() req: RequestWithUser,
  ) {
    return this.curriculum.createSchoolProfile(dto, req.user);
  }

  @Post('profiles/:profileId/versions')
  @Permission(...SCHOOL_CURRICULUM_MANAGERS)
  @ApiOperation({ summary: 'Create an immutable-ready draft ŠVP snapshot' })
  createVersion(
    @Param('profileId', new ParseUUIDPipe()) profileId: string,
    @Body() dto: CreateSchoolCurriculumVersionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.curriculum.createSchoolCurriculumVersion(
      profileId,
      dto,
      req.user,
    );
  }

  @Get('versions/:versionId')
  @Permission(...SCHOOL_CURRICULUM_READERS)
  @NoHttpCache()
  @ApiOperation({ summary: 'Read one school curriculum snapshot with mappings' })
  getVersion(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.curriculum.getSchoolCurriculumVersion(versionId, req.user);
  }

  @Post('versions/:versionId/publish')
  @Permission(...SCHOOL_CURRICULUM_MANAGERS)
  @ApiOperation({ summary: 'Publish and freeze a reviewed ŠVP version' })
  publishVersion(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.curriculum.publishSchoolCurriculumVersion(versionId, req.user);
  }

  @Post('versions/:versionId/retire')
  @Permission(...SCHOOL_CURRICULUM_MANAGERS)
  @ApiOperation({ summary: 'Retire a published ŠVP version without deleting history' })
  retireVersion(
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.curriculum.retireSchoolCurriculumVersion(versionId, req.user);
  }

  @Post('applicabilities')
  @Permission(...SCHOOL_CURRICULUM_MANAGERS)
  @ApiOperation({ summary: 'Bind a published ŠVP/framework release to year, grade or class' })
  createApplicability(
    @Body() dto: CreateCurriculumApplicabilityDto,
    @Req() req: RequestWithUser,
  ) {
    return this.curriculum.createApplicability(dto, req.user);
  }

  @Post('applicabilities/:id/retire')
  @Permission(...SCHOOL_CURRICULUM_MANAGERS)
  @ApiOperation({ summary: 'Retire an applicability rule without deleting history' })
  retireApplicability(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.curriculum.retireApplicability(id, req.user);
  }

  @Get('resolve')
  @Permission(...SCHOOL_CURRICULUM_READERS)
  @NoHttpCache()
  @ApiOperation({
    summary: 'Resolve exact published curriculum for class + academic year',
  })
  resolve(
    @Query() query: ResolveCurriculumApplicabilityDto,
    @Req() req: RequestWithUser,
  ) {
    return this.curriculum.resolveApplicability(query, req.user);
  }

  @Post('mappings')
  @Permission(...SCHOOL_CURRICULUM_READERS)
  @ApiOperation({ summary: 'Propose school outcome → canonical outcome/aspect mapping' })
  proposeMapping(
    @Body() dto: ProposeSchoolOutcomeMappingDto,
    @Req() req: RequestWithUser,
  ) {
    return this.curriculum.proposeSchoolOutcomeMapping(dto, req.user);
  }

  @Post('mappings/:id/review')
  @Permission(...SCHOOL_CURRICULUM_MANAGERS)
  @ApiOperation({ summary: 'Human-review a proposed school outcome mapping' })
  reviewMapping(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewSchoolOutcomeMappingDto,
    @Req() req: RequestWithUser,
  ) {
    return this.curriculum.reviewSchoolOutcomeMapping(id, dto, req.user);
  }

  @Post('mappings/refresh-stale')
  @Permission(...SCHOOL_CURRICULUM_MANAGERS)
  @ApiOperation({ summary: 'Detect and mark mappings whose provenance changed' })
  refreshStaleMappings(@Req() req: RequestWithUser) {
    return this.curriculum.refreshStaleMappings(req.user);
  }
}
