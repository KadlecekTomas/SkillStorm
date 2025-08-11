// src/stats/stats.controller.ts
import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
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
import { CacheTTL } from '@nestjs/cache-manager';
import { StatsService } from './stats.service';
import {
  OverviewScope,
  StatsOverviewQueryDto,
} from './dto/stats-overview-query.dto';

@ApiTags('Stats')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class StatsController {
  constructor(private readonly service: StatsService) {}

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
    enum: Object.values(OverviewScope), // drží to sync s DTO
    description:
      'How passRate is computed. "evaluated" = APPROVED/(APPROVED+REJECTED). "all" = APPROVED/all submissions (incl. PENDING). Default: evaluated.',
  })
  @CacheTTL(0)
  overview(@Request() req, @Query() query: StatsOverviewQueryDto) {
    const { organizationId } = req.user;
    const scope = query.scope ?? OverviewScope.EVALUATED; // sanitizované v DTO
    return this.service.getOrgOverview(organizationId, req.user, scope);
  }

  @Get('dashboards/student')
  @Roles(OrganizationRole.STUDENT, SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Student dashboard (my progress)' })
  @CacheTTL(0)
  student(@Request() req) {
    const { membershipId, organizationId } = req.user;
    return this.service.getStudentDashboard(
      { membershipId, organizationId },
      req.user,
    );
  }

  @Get('dashboards/teacher')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Teacher dashboard (my classes/tests/performance)' })
  @CacheTTL(0)
  teacher(@Request() req) {
    const { membershipId, organizationId } = req.user;
    return this.service.getTeacherDashboard(
      { membershipId, organizationId },
      req.user,
    );
  }
}
