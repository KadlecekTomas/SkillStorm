import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { AddXpEventDto } from './dto/add-xp-event.dto';
import { Permission } from 'src/modules/rbac/permission.decorator';
import { PermissionKey } from '@prisma/client';

@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Post('xp')
  @Permission(PermissionKey.MANAGE_STUDENTS)
  addXp(@Body() dto: AddXpEventDto, @Req() req) {
    return this.gamification.addXpEvent(dto, req.user);
  }

  @Get('summary/:membershipId')
  async summary(@Param('membershipId') membershipId: string, @Req() req) {
    return this.gamification.getSummary(membershipId, req.user);
  }
}
