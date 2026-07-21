import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import { RequestWithUser } from '@/types/request-with-user';
import {
  clearAuthCookies,
  setLearningSessionCookies,
} from '@/auth/token-cookies';
import { GuardianSessionsService } from './guardian-sessions.service';
import { StartLearningSessionDto } from './dto/start-learning-session.dto';

/**
 * Žákovské relace (Etapa C). Doménově omezená operace — nikdy generický
 * login-as (spec bod 18). Autorizace je vztahová: aktivní role PARENT +
 * VERIFIED vztah + oprávnění, vše z DB per request; ukončení smí i dítě
 * v běžící relaci (claim learningSessionId) a škola.
 *
 * rbac-checked: inline (vztahová autorizace per dítě, viz service)
 */
@ApiTags('guardian')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('guardian/student-sessions')
export class GuardianSessionsController {
  constructor(private readonly service: GuardianSessionsService) {}

  @Post()
  @ApiOperation({
    summary:
      '„Spustit pro Matěje" — vytvoří relaci a PŘEPÍŠE cookies žákovskými tokeny (bez refresh)',
  })
  async start(
    @Body() dto: StartLearningSessionDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.startSession(dto, req.user);
    const maxAgeMs = result.session.expiresAt.getTime() - Date.now();
    setLearningSessionCookies(res, result.accessToken, maxAgeMs);
    return ok({ session: result.session });
  }

  @Post(':sessionId/end')
  @ApiOperation({
    summary:
      'Ukončení relace (dítě v relaci / iniciátor / škola) — dítěti smaže auth cookies',
  })
  async end(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.endSession(sessionId, req.user);
    if (result.wasChild) {
      // Konec žákovského režimu na sdíleném zařízení: token je už mrtvý
      // (status ENDED), cookies nesmí zůstat — návrat = rodičovské heslo.
      clearAuthCookies(res);
    }
    return ok({ sessionId: result.sessionId, ended: result.ended });
  }

  @Get('active')
  @ApiOperation({ summary: 'Běžící relace dítěte pro rodinný prostor' })
  @NoHttpCache()
  async active(
    @Query('studentId', new ParseUUIDPipe()) studentId: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.activeSessionFor(studentId, req.user));
  }
}
