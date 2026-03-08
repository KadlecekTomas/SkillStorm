import { Controller, Get } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @Public()
  async getHealth() {
    return this.healthService.getHealth();
  }

  @Get('version')
  @Public()
  getVersion() {
    return this.healthService.getVersion();
  }
}
