import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GuardianPermissionKey } from '@prisma/client';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import { RequestWithUser } from '@/types/request-with-user';
import { GuardianService } from './guardian.service';
import {
  GuardianAccessGuard,
  RequireGuardianPermission,
} from './guardian-access.guard';

/**
 * Rodičovská strana guardian API. Žádný @Permission — autorizace stojí na
 * aktivní roli PARENT + vztahu ke KONKRÉTNÍMU dítěti, obojí se vyhodnocuje
 * z DB při každém požadavku (GuardianAccessGuard / requireParentMembership
 * v GuardianService; revokace platí okamžitě). Plošný PermissionKey by tady
 * byl slabší než per-dítě kontrola vztahu. Odpovědi nikdy nenesou
 * XP/level/parťáka (neporušitelný princip 5).
 *
 * rbac-checked: inline (viz výše — vztahová autorizace per dítě, ne role)
 */
@ApiTags('guardian')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('guardian')
export class GuardianController {
  constructor(private readonly service: GuardianService) {}

  @Get('children')
  @ApiOperation({
    summary:
      'Děti aktivního rodičovského membershipu (VERIFIED + PENDING k potvrzení)',
  })
  @NoHttpCache()
  async listChildren(@Req() req: RequestWithUser) {
    return ok(this.service.listChildren(req.user));
  }

  @Get('children/:studentId/overview')
  @UseGuards(GuardianAccessGuard)
  @RequireGuardianPermission(GuardianPermissionKey.VIEW_ASSIGNMENTS)
  @ApiOperation({
    summary:
      'Rodinný prostor dítěte — 4 bloky: úkoly, jak se daří, zprávy, další krok',
  })
  @NoHttpCache()
  async childOverview(
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
  ) {
    return ok(this.service.getChildOverview(studentId));
  }

  @Post('relations/:relationId/confirm')
  @ApiOperation({
    summary: 'Potvrzení vztahu rodičem („Ano, je to moje dítě") → VERIFIED',
  })
  async confirm(
    @Param('relationId', new ParseUUIDPipe()) relationId: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.resolvePendingRelation(relationId, true, req.user));
  }

  @Post('relations/:relationId/dispute')
  @ApiOperation({
    summary:
      'Rozporování vztahu rodičem („Ne, to není moje dítě") → DISPUTED, viditelné škole',
  })
  async dispute(
    @Param('relationId', new ParseUUIDPipe()) relationId: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.resolvePendingRelation(relationId, false, req.user));
  }
}
