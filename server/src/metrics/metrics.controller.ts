import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
} from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
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
  @Throttle({ default: { limit: 20, ttl: seconds(60) } })
  async record(
    @Body() dto: RecordRbacMetricDto,
    @Headers('x-metrics-key') ingestKey?: string,
  ) {
    const expectedKey = process.env.METRICS_INGEST_KEY?.trim();
    if (!expectedKey || ingestKey !== expectedKey) {
      throw new ForbiddenException('Invalid metrics ingest key');
    }
    await this.metrics.recordForbiddenAccess(dto);
    return { status: 'queued' };
  }

  @Get('summary')
  @Permission(PermissionKey.VIEW_RESULTS)
  async summary() {
    return this.metrics.summary();
  }
}
