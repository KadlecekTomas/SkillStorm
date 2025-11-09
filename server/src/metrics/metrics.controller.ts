import { Body, Controller, Get, Post } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { RecordRbacMetricDto } from './dto/record-rbac-metric.dto';
import { Public } from '@/common/decorators/public.decorator';
import { Permission } from '@/modules/rbac/permission.decorator';
import { PermissionKey } from '@prisma/client';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Post('rbac')
  @Public()
  async record(@Body() dto: RecordRbacMetricDto) {
    await this.metrics.recordForbiddenAccess(dto);
    return { status: 'queued' };
  }

  @Get('summary')
  @Permission(PermissionKey.VIEW_RESULTS)
  async summary() {
    return this.metrics.summary();
  }
}
