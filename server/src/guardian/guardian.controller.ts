import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import { RequestWithUser } from '@/types/request-with-user';
import { GuardianService } from './guardian.service';

/**
 * Rodičovská strana guardian API. Žádný @Permission — autorizace stojí na
 * aktivní roli PARENT + vztahu k dítěti, obojí vyhodnocuje GuardianService
 * z DB při každém požadavku (revokace platí okamžitě). Odpovědi nikdy
 * nenesou XP/level/parťáka (neporušitelný princip 5).
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
