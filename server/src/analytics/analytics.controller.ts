import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { LogAnalyticsEventDto } from './dto/log-analytics-event.dto';
import { Permission } from '@/modules/rbac/permission.decorator';
import { PermissionKey } from '@prisma/client';
import { RequestWithUser } from '@/types/request-with-user';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RequireCurrentAcademicYearGuard } from '@/academic-years/require-current-academic-year.guard';
import { OrgOperation, OrgOperationType } from '@/common/decorators/org-operation.decorator';

@Controller('analytics')
@OrgOperation(OrgOperationType.EXECUTION)
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
  @UseGuards(JwtAuthGuard, RequireCurrentAcademicYearGuard)
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
  @UseGuards(JwtAuthGuard, RequireCurrentAcademicYearGuard)
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

  @Get('student/errors')
  @UseGuards(JwtAuthGuard, RequireCurrentAcademicYearGuard)
  @Permission(PermissionKey.VIEW_RESULTS)
  studentErrors(
    @Query('yearId') yearId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.analytics.studentErrorOverview(yearId, req.user);
  }

  @Get('student/topics')
  @UseGuards(JwtAuthGuard, RequireCurrentAcademicYearGuard)
  @Permission(PermissionKey.VIEW_RESULTS)
  studentTopics(
    @Query('yearId') yearId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.analytics.studentTopicOverview(yearId, req.user);
  }

  @Get('teacher/:classId/errors')
  @UseGuards(JwtAuthGuard, RequireCurrentAcademicYearGuard)
  @Permission(PermissionKey.VIEW_RESULTS)
  teacherErrors(
    @Param('classId') classId: string,
    @Query('yearId') yearId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.analytics.teacherClassErrorOverview(yearId, classId, req.user);
  }

  @Get('teacher/:classId/topics')
  @UseGuards(JwtAuthGuard, RequireCurrentAcademicYearGuard)
  @Permission(PermissionKey.VIEW_RESULTS)
  teacherTopics(
    @Param('classId') classId: string,
    @Query('yearId') yearId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.analytics.teacherClassTopicOverview(yearId, classId, req.user);
  }
}
