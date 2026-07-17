import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { CampaignsService } from './campaigns.service';
import { StartCampaignDto } from './dto/start-campaign.dto';
import { SubmitEpilogueDto } from './dto/submit-epilogue.dto';

/**
 * Kampaně (Výprava/Mise) — meziherní vrstva NAD bleskovkami. Všechny
 * endpointy TEACHER+ (CREATE_TEST), stejně jako live-sessions; RBAC na
 * úrovni tříd řeší service (učitel jen třídy, které učí).
 * Vzkaz minulé třídy: projekční detail ho vrací až po explicitním revealu
 * učitelem TÉTO třídy (stejný kontrakt jako correctKey u kol).
 */
@ApiTags('campaigns')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly service: CampaignsService,
    private readonly orgContext: OrgContextService,
  ) {}

  @Get()
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({ summary: 'Kampaně dostupné pro třídu (dle ročníku)' })
  @NoHttpCache()
  async listForClass(
    @Query('classSectionId', new ParseUUIDPipe()) classSectionId: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.listForClass(classSectionId, ctx));
  }

  @Get('progress')
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({ summary: 'Rozehrané kampaně třídy' })
  @NoHttpCache()
  async listProgress(
    @Query('classSectionId', new ParseUUIDPipe()) classSectionId: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.listProgress(classSectionId, ctx));
  }

  @Post('progress')
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({ summary: 'Rozehrát kampaň pro třídu' })
  async startCampaign(
    @Body() dto: StartCampaignDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(
      this.service.startCampaign(dto.campaignId, dto.classSectionId, ctx),
    );
  }

  @Get('progress/:id')
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({
    summary:
      'Detail postupu (mapa/nástěnka) — odemčené kroky + silueta dalšího',
  })
  @NoHttpCache()
  @Header('Cache-Control', 'no-store')
  async getProgressDetail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.getProgressDetail(id, ctx));
  }

  @Post('progress/:id/epilogue')
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({ summary: 'Nahrát vzkaz budoucí třídě (Mise, po dokončení)' })
  async submitEpilogue(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SubmitEpilogueDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.submitEpilogue(id, dto.message, ctx));
  }

  @Get('progress/:id/predecessor-message')
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({
    summary: 'Náhled vzkazu minulé třídy (jen pro učitele, bez revealu)',
  })
  @NoHttpCache()
  @Header('Cache-Control', 'no-store')
  async previewPredecessorMessage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.previewPredecessorMessage(id, ctx));
  }

  @Post('progress/:id/predecessor-message/reveal')
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({
    summary: 'Potvrdit zobrazení vzkazu minulé třídy na projekci',
  })
  async revealPredecessorMessage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.revealPredecessorMessage(id, ctx));
  }
}
