import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { LogAnalyticsEventDto } from './dto/log-analytics-event.dto';
import { Permission } from '@/modules/rbac/permission.decorator';
import { PermissionKey } from '@prisma/client';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('log')
  async log(@Body() dto: LogAnalyticsEventDto, @Req() req) {
    return this.analytics.logEvent(dto, req.user);
  }

  @Get('summary')
  @Permission(PermissionKey.VIEW_ANALYTICS)
  summary(@Query('days') days = '7', @Req() req) {
    return this.analytics.summary(Number(days) || 7, req.user.organizationId);
  }
}
