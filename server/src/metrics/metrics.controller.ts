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
import { UseGuards } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PlatformAccessGuard } from '@/common/guards/platform-access.guard';
import {
  PlatformAccessLevel,
  RequirePlatformAccess,
} from '@/common/decorators/platform-access.decorator';
import { AllowAnyOrgStatus } from '@/common/decorators/allow-any-org-status.decorator';

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

  // Guardian audit N1: platformní metrika (počet FORBIDDEN_ACCESS bez org
  // filtru) patří platformním rolím, ne komukoli s VIEW_RESULTS.
  @Get('summary')
  @UseGuards(JwtAuthGuard, PlatformAccessGuard)
  @RequirePlatformAccess(PlatformAccessLevel.READ)
  // Platformní metrika je nezávislá na stavu organizace vyzyvatele.
  @AllowAnyOrgStatus()
  async summary() {
    return this.metrics.summary();
  }
}
