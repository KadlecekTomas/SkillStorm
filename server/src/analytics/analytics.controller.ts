import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { LogAnalyticsEventDto } from './dto/log-analytics-event.dto';
import { Permission } from '@/modules/rbac/permission.decorator';
import { PermissionKey } from '@prisma/client';
import { RequestWithUser } from '@/types/request-with-user';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RequireActiveAcademicYearGuard } from '@/academic-years/require-active-academic-year.guard';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('log')
  async log(
    @Body() dto: LogAnalyticsEventDto,
    @Req() req: RequestWithUser,
  ): ReturnType<AnalyticsService['logEvent']> {
    return this.analytics.logEvent(dto, req.user);
  }

  @Get('summary')
  @Permission(PermissionKey.VIEW_ANALYTICS)
  summary(
    @Query('days') days = '7',
    @Req() req: RequestWithUser,
  ): ReturnType<AnalyticsService['summary']> {
    return this.analytics.summary(Number(days) || 7, req.user.organizationId);
  }

  @Get('student-timeline')
  @UseGuards(JwtAuthGuard, RequireActiveAcademicYearGuard)
  @Permission(PermissionKey.VIEW_RESULTS, PermissionKey.VIEW_ANALYTICS)
  studentTimeline(
    @Query('yearId') yearId: string,
    @Query('studentId') studentId: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    const resolvedStudentId: string | null =
      typeof studentId === 'string' && studentId.length > 0 ? studentId : null;
    return this.analytics.studentTimeline(
      yearId,
      req.user,
      resolvedStudentId ?? null,
    );
  }

  @Get('class-heatmap')
  @UseGuards(JwtAuthGuard, RequireActiveAcademicYearGuard)
  @Permission(PermissionKey.VIEW_ANALYTICS)
  classHeatmap(
    @Query('yearId') yearId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.analytics.classHeatmap(
      yearId,
      req.user.organizationId ?? null,
    );
  }
}
