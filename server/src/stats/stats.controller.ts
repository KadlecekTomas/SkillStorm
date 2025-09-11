import {
  Controller,
  Get,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SystemRole, OrganizationRole } from '@prisma/client';
// ⚠️ odstraněn CacheTTL import
import { StatsService } from './stats.service';
import {
  OverviewScope,
  StatsOverviewQueryDto,
} from './dto/stats-overview-query.dto';
import { NoHttpCacheInterceptor } from 'src/common/interceptors/no-http-cache.interceptor';

export const DEFAULT_STATS_OVERVIEW_SCOPE = 'evaluated' as const;

@ApiTags('Stats')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class StatsController {
  constructor(private readonly service: StatsService) {}

  @UseInterceptors(NoHttpCacheInterceptor)
  @Get('stats/overview')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
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
  overview(@Request() req, @Query() query: StatsOverviewQueryDto) {
    const { organizationId } = req.user;

    // tvrdá sanitizace: cokoliv mimo 'all' => 'evaluated'
    const raw = (query?.scope ?? '').toString().trim().toLowerCase();
    const scope = (raw === 'all' ? 'all' : 'evaluated') as 'evaluated' | 'all';

    return this.service.getOrgOverview(organizationId, req.user, scope);
  }

  @UseInterceptors(NoHttpCacheInterceptor)
  @Get('dashboards/student')
  @Roles(OrganizationRole.STUDENT, SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Student dashboard (my progress)' })
  // ⚠️ odstraněno @CacheTTL(0)
  student(@Request() req) {
    const { membershipId, organizationId } = req.user;
    return this.service.getStudentDashboard(
      { membershipId, organizationId },
      req.user,
    );
  }

  @UseInterceptors(NoHttpCacheInterceptor)
  @Get('dashboards/teacher')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Teacher dashboard (my classes/tests/performance)' })
  // ⚠️ odstraněno @CacheTTL(0)
  teacher(@Request() req) {
    const { membershipId, organizationId } = req.user;
    return this.service.getTeacherDashboard(
      { membershipId, organizationId },
      req.user,
    );
  }
}
