import {
  Controller,
  Get,
  Query,
  Req,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { RequestWithUser } from '@/types/request-with-user';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Permission } from '@/modules/rbac/permission.decorator';
import { PermissionKey } from '@prisma/client';
// ⚠️ odstraněn CacheTTL import
import { StatsService } from './stats.service';
import {
  OverviewScope,
  StatsOverviewQueryDto,
} from './dto/stats-overview-query.dto';
import { NoHttpCacheInterceptor } from '@/common/interceptors/no-http-cache.interceptor';
import { OrgOperation, OrgOperationType } from '@/common/decorators/org-operation.decorator';

export const DEFAULT_STATS_OVERVIEW_SCOPE = 'evaluated' as const;

@ApiTags('Stats')
@ApiBearerAuth()
@Controller()
@OrgOperation(OrgOperationType.EXECUTION)
export class StatsController {
  constructor(private readonly service: StatsService) {}

  @UseInterceptors(NoHttpCacheInterceptor)
  @Get('stats/overview')
  @Permission(PermissionKey.VIEW_RESULTS)
  @ApiOperation({
    summary: 'Organization overview (tests, submissions, averages)',
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: Object.values(OverviewScope),
    description:
      'How passRate is computed. "evaluated" = APPROVED/(APPROVED+REJECTED). "all" = APPROVED/ALL (incl. PENDING). Default: evaluated.',
  })
  // ⚠️ odstraněno @CacheTTL(0)
  overview(@Req() req: RequestWithUser, @Query() query: StatsOverviewQueryDto) {
    const organizationId = req.user.organizationId ?? null;

    // tvrdá sanitizace: cokoliv mimo 'all' => 'evaluated'
    const raw = (query?.scope ?? '').toString().trim().toLowerCase();
    const scope = (raw === 'all' ? 'all' : 'evaluated') as 'evaluated' | 'all';

    return this.service.getOrgOverview(organizationId, req.user, scope);
  }

  @UseInterceptors(NoHttpCacheInterceptor)
  @Get('dashboards/student')
  @Permission(PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'Student dashboard (my progress)' })
  // ⚠️ odstraněno @CacheTTL(0)
  student(@Req() req: RequestWithUser) {
    const organizationId = req.user.organizationId ?? null;
    const membershipPayload: {
      membershipId?: string;
      organizationId: string | null;
    } = { organizationId };
    if (req.user.membershipId) {
      membershipPayload.membershipId = req.user.membershipId;
    }
    return this.service.getStudentDashboard(membershipPayload, req.user);
  }

  @UseInterceptors(NoHttpCacheInterceptor)
  @Get('dashboards/teacher')
  @Permission(PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'Teacher dashboard (my classes/tests/performance)' })
  // ⚠️ odstraněno @CacheTTL(0)
  teacher(@Req() req: RequestWithUser) {
    const organizationId = req.user.organizationId ?? null;
    return this.service.getTeacherDashboard(organizationId, req.user);
  }

  @UseInterceptors(NoHttpCacheInterceptor)
  @Get('dashboards/director')
  @Permission(PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'Director dashboard (school command center)' })
  director(@Req() req: RequestWithUser) {
    const organizationId = req.user.organizationId ?? null;
    return this.service.getDirectorDashboard(organizationId, req.user);
  }
}
