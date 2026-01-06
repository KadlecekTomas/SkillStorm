import { Body, Controller, Post, Req, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ok } from '@/common/http/envelope';
import { Permission } from '@/modules/rbac/permission.decorator';
import { PermissionKey, SystemRole, OrganizationRole } from '@prisma/client';
import { PrivacyService } from './privacy.service';
import { AnonymizeUserDto } from './dto/anonymize-user.dto';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { PrismaService } from '@/prisma/prisma.service';

@ApiTags('privacy')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('privacy')
export class PrivacyController {
  constructor(
    private readonly privacyService: PrivacyService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('anonymize-user')
  @ApiOperation({ summary: 'Anonymizuje uživatele (GDPR Right to Erasure)' })
  @Permission(
    PermissionKey.MANAGE_TEACHERS,
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
  )
  async anonymize(@Body() dto: AnonymizeUserDto, @Req() req: any) {
    // org-scope enforcement: requester must share org with target (unless SUPERADMIN)
    if (req.user?.systemRole !== 'SUPERADMIN') {
      const targetMembership = await this.prisma.membership.findFirst({
        where: { userId: dto.userId, deletedAt: null },
        select: { organizationId: true },
      });
      if (
        !targetMembership ||
        targetMembership.organizationId !== req.user?.organizationId
      ) {
        throw new ForbiddenException('Invalid org scope');
      }
    }

    await this.privacyService.anonymizeUser(dto.userId, req.user?.userId);
    return ok({ status: 'anonymized' });
  }
}
