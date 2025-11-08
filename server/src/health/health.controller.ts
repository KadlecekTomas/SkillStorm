import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @Public()
  getHealth() {
    return this.healthService.getHealth();
  }

  @Get('version')
  @Public()
  getVersion() {
    return this.healthService.getVersion();
  }
}
