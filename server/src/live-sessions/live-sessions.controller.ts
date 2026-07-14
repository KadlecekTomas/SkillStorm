import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionKey } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';
import { RequestWithUser } from '@/types/request-with-user';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import { OrgContextService } from '@/common/org-context/org-context.service';
import { LiveSessionsService } from './live-sessions.service';
import { CreateLiveSessionDto } from './dto/create-live-session.dto';
import { RoundOutcomeDto } from './dto/round-outcome.dto';

/**
 * Bleskovky (režim B / BOARD_ONLY). Všechny endpointy jsou TEACHER+
 * (CREATE_TEST) — projekce běží pod přihlášeným učitelem, žádné žákovské
 * přihlášení ani veřejná URL. Join endpointy přibudou až s režimem A.
 */
@ApiTags('live-sessions')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('live-sessions')
export class LiveSessionsController {
  constructor(
    private readonly service: LiveSessionsService,
    private readonly orgContext: OrgContextService,
  ) {}

  // Statická routa dřív než ':id', ať ji Nest nechytí jako UUID.
  @Get('class-partak/:classSectionId')
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({ summary: 'Stav třídního parťáka' })
  @NoHttpCache()
  async getClassPartak(
    @Param('classSectionId', new ParseUUIDPipe()) classSectionId: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.getClassPartak(classSectionId, ctx));
  }

  @Post()
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({ summary: 'Založit bleskovku (DRAFT)' })
  async create(@Body() dto: CreateLiveSessionDto, @Req() req: RequestWithUser) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.create(dto, ctx));
  }

  @Post(':id/start')
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({ summary: 'Spustit bleskovku (snapshot kol)' })
  async start(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.start(id, ctx));
  }

  @Get(':id')
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({
    summary: 'Data pro projekci (bez správných klíčů neodhalených kol)',
  })
  @NoHttpCache()
  @Header('Cache-Control', 'no-store')
  async getProjection(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.getProjection(id, ctx));
  }

  @Post(':id/rounds/:roundId/reveal')
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({ summary: 'Odhalit správnou odpověď kola' })
  async reveal(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.reveal(id, roundId, ctx));
  }

  @Post(':id/rounds/:roundId/outcome')
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({ summary: 'Zadat výsledek kola (3 tlačítka)' })
  async setOutcome(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
    @Body() dto: RoundOutcomeDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.setOutcome(id, roundId, dto.outcome, ctx));
  }

  @Post(':id/finish')
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({ summary: 'Ukončit bleskovku + připsat XP parťákovi' })
  async finish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.finish(id, ctx));
  }
}
