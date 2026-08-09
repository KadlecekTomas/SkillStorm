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
import { OrganizationRole } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';
import { RequestWithUser } from '@/types/request-with-user';
import { OrgContextService } from '@/common/org-context/org-context.service';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import {
  OrgOperation,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';
import { BuildPcAnalyticsService } from './build-pc-analytics.service';
import { ClassroomOrchestrationService } from './classroom-orchestration.service';
import { NetworkedCoopService } from './networked-coop.service';
import {
  ClassroomCommandDto,
  CreateLessonLiveSessionDto,
  CreateSessionGroupsDto,
  JoinClassroomSessionDto,
  SemanticEventDto,
} from './dto/classroom-orchestration.dto';
import { NetworkedCoopTransitionDto } from './dto/networked-coop.dto';

@ApiTags('classroom-sessions')
@ApiBearerAuth()
@Controller('classroom-sessions')
@NoHttpCache()
@OrgOperation(OrgOperationType.EXECUTION)
export class ClassroomOrchestrationController {
  constructor(
    private readonly service: ClassroomOrchestrationService,
    private readonly buildPcAnalytics: BuildPcAnalyticsService,
    private readonly networkedCoop: NetworkedCoopService,
    private readonly orgContext: OrgContextService,
  ) {}

  @Post()
  @Permission(
    OrganizationRole.TEACHER,
    OrganizationRole.DIRECTOR,
    OrganizationRole.OWNER,
  )
  @ApiOperation({ summary: 'Create a Lesson Experience classroom session' })
  async create(
    @Body() dto: CreateLessonLiveSessionDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return this.service.createLessonSession(dto, ctx);
  }

  @Get(':id')
  @Permission(
    OrganizationRole.TEACHER,
    OrganizationRole.DIRECTOR,
    OrganizationRole.OWNER,
  )
  @ApiOperation({ summary: 'Teacher Mission Control projection' })
  async teacherProjection(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return this.service.getTeacherProjection(id, ctx);
  }

  @Get(':id/build-pc-analytics')
  @Permission(
    OrganizationRole.TEACHER,
    OrganizationRole.DIRECTOR,
    OrganizationRole.OWNER,
  )
  @ApiOperation({ summary: 'Privacy-safe Build a PC Mission Control analytics' })
  async buildPcMissionAnalytics(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return this.buildPcAnalytics.get(id, ctx);
  }

  @Post(':id/commands')
  @Permission(
    OrganizationRole.TEACHER,
    OrganizationRole.DIRECTOR,
    OrganizationRole.OWNER,
  )
  @ApiOperation({ summary: 'Apply an idempotent classroom state command' })
  async command(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ClassroomCommandDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return this.service.command(id, dto, ctx);
  }

  @Post(':id/groups')
  @Permission(
    OrganizationRole.TEACHER,
    OrganizationRole.DIRECTOR,
    OrganizationRole.OWNER,
  )
  @ApiOperation({ summary: 'Provision shared-device groups before lesson start' })
  async createGroups(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateSessionGroupsDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return this.service.createSharedDeviceGroups(id, dto, ctx);
  }

  @Post(':id/join')
  @Permission(OrganizationRole.STUDENT)
  @ApiOperation({ summary: 'Join or reconnect current student device' })
  async join(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: JoinClassroomSessionDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return this.service.joinAsStudent(id, dto, ctx);
  }

  @Post(':id/disconnect')
  @Permission(OrganizationRole.STUDENT)
  @ApiOperation({ summary: 'Mark current student device disconnected' })
  async disconnect(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return this.service.disconnectStudent(id, ctx);
  }

  @Get(':id/me')
  @Permission(OrganizationRole.STUDENT)
  @ApiOperation({ summary: 'Reconnect-safe student session projection' })
  async studentProjection(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return this.service.getStudentProjection(id, ctx);
  }

  @Get(':id/coop')
  @Permission(OrganizationRole.STUDENT)
  @ApiOperation({ summary: 'Server-authoritative Planner/Programmer pair projection' })
  async coopProjection(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return this.networkedCoop.get(id, ctx);
  }

  @Post(':id/coop/transition')
  @Permission(OrganizationRole.STUDENT)
  @ApiOperation({ summary: 'Idempotent Planner/Programmer handoff or role rotation' })
  async coopTransition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: NetworkedCoopTransitionDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return this.networkedCoop.transition(id, dto, ctx);
  }

  @Post(':id/events')
  @Permission(OrganizationRole.STUDENT)
  @ApiOperation({ summary: 'Record an idempotent semantic learning event' })
  async event(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SemanticEventDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return this.service.recordSemanticEvent(id, dto, ctx);
  }
}
