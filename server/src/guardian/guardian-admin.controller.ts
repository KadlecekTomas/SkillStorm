import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { SetStudentPinDto } from './dto/set-student-pin.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionKey } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import { OrgContextService } from '@/common/org-context/org-context.service';
import { RequestWithUser } from '@/types/request-with-user';
import { GuardianService } from './guardian.service';

/**
 * Školní strana guardian párování. INVITE_STUDENTS (TEACHER+) — třídní
 * generuje arch kódů pro svou třídu; TEACHER scope na vlastní třídy vynucuje
 * GuardianService přes teacherClassScope, DIRECTOR/OWNER org-wide.
 */
@ApiTags('guardian-admin')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller()
export class GuardianAdminController {
  constructor(
    private readonly service: GuardianService,
    private readonly orgContext: OrgContextService,
  ) {}

  @Post('classrooms/:classSectionId/guardian-invites/bulk')
  @Permission(PermissionKey.INVITE_STUDENTS)
  @ApiOperation({
    summary:
      'Bulk párovací kódy pro celou třídu (primární flow) — data pro tisknutelný arch lístečků',
  })
  async createBulk(
    @Param('classSectionId', new ParseUUIDPipe()) classSectionId: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.createBulkGuardianInvites(classSectionId, ctx));
  }

  @Post('students/:studentId/guardian-invites')
  @Permission(PermissionKey.INVITE_STUDENTS)
  @ApiOperation({
    summary: 'Párovací kód pro jednoho žáka (sekundární flow)',
  })
  async createOne(
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.createGuardianInvite(studentId, ctx));
  }

  @Get('students/:studentId/guardians')
  @Permission(PermissionKey.INVITE_STUDENTS)
  @ApiOperation({
    summary: 'Stav párování žáka (vč. DISPUTED — řeší třídní revokací)',
  })
  @NoHttpCache()
  async listGuardians(
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.listStudentGuardians(studentId, ctx));
  }

  @Post('students/:studentId/pin')
  @Permission(PermissionKey.INVITE_STUDENTS)
  @ApiOperation({
    summary: 'Nastavení/reset žákovského PINu školou (4–6 číslic, jen hash)',
  })
  async setPin(
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
    @Body() dto: SetStudentPinDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.setStudentPin(studentId, dto.pin, ctx));
  }

  @Post('guardian/relations/:relationId/revoke')
  @Permission(PermissionKey.INVITE_STUDENTS)
  @ApiOperation({
    summary: 'Revokace vztahu školou — okamžitý konec přístupu rodiče',
  })
  async revoke(
    @Param('relationId', new ParseUUIDPipe()) relationId: string,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    return ok(this.service.revokeRelation(relationId, ctx));
  }
}
