import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { Permission } from '@/modules/rbac/permission.decorator';
import { OrganizationRole, PermissionKey } from '@prisma/client';
import { RequestWithUser } from '@/types/request-with-user';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { ok } from '@/common/http/envelope';
import { AllowPendingOrg } from '@/common/decorators/allow-pending-org.decorator';
import { OrgOperation, OrgOperationType } from '@/common/decorators/org-operation.decorator';
import { AcademicYearsService } from './academic-years.service';
import { PromotionService } from './promotion.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { PromoteYearDto } from './dto/promote-year.dto';

@ApiTags('AcademicYears')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('academic-years')
@OrgOperation(OrgOperationType.AUTHORING)
export class AcademicYearsController {
  constructor(
    private readonly service: AcademicYearsService,
    private readonly promotionService: PromotionService,
  ) {}

  @Get()
  @AllowPendingOrg()
  @Permission(PermissionKey.VIEW_RESULTS, PermissionKey.MANAGE_STUDENTS)
  @CacheTTL(0) // vypnout HTTP response cache – používáme verzovanou cache v service
  @ApiOperation({
    summary: 'List academic years for organization',
    description:
      'Allowed when org is NOT_READY so classrooms page can load years for first-class creation.',
  })
  list(@Req() req: RequestWithUser) {
    return ok(this.service.list(req.user));
  }

  @Get('active')
  @AllowPendingOrg()
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Get current academic year (deprecated)',
    description:
      'Deprecated: use GET /academic-years/current instead. Returns same payload. Kept for backward compatibility.',
  })
  /** @deprecated Use getCurrent() and GET /academic-years/current instead. */
  getActive(@Req() req: RequestWithUser) {
    return ok(this.service.getCurrentForOrgOrFail(req.user.organizationId ?? null));
  }

  @Get('current')
  @AllowPendingOrg()
  @CacheTTL(0)
  @ApiOperation({ summary: 'Get current academic year (id + name only, single source of truth)' })
  async getCurrent(@Req() req: RequestWithUser) {
    const year = await this.service.getCurrentForOrgOrFail(req.user.organizationId ?? null);
    return ok({ id: year.id, name: year.name });
  }

  @Post()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Create academic year' })
  create(@Body() dto: CreateAcademicYearDto, @Req() req: RequestWithUser) {
    return ok(this.service.create(dto, req.user));
  }

  @Patch(':id/activate')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Activate academic year for organization' })
  activate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.activate(id, req.user));
  }

  @Post(':fromYearId/promote')
  @Permission(OrganizationRole.DIRECTOR, OrganizationRole.OWNER)
  @ApiOperation({
    summary: 'Promote classrooms to next academic year',
    description:
      'Copies all classrooms (grade+1, same section), teacher assignments, and ACTIVE enrollments. Idempotent per (org, fromYearId). Only immediate next year allowed.',
  })
  promote(
    @Param('fromYearId', new ParseUUIDPipe()) fromYearId: string,
    @Body() dto: PromoteYearDto,
    @Req() req: RequestWithUser,
  ) {
    const orgId = req.user.organizationId ?? '';
    return ok(
      this.promotionService.promoteAcademicYear(
        orgId,
        fromYearId,
        dto.toYearId,
        req.user,
      ),
    );
  }

  @Get(':fromYearId/promotion-status')
  @AllowPendingOrg()
  @Permission(PermissionKey.VIEW_RESULTS, PermissionKey.MANAGE_STUDENTS)
  @CacheTTL(0)
  @ApiOperation({ summary: 'Check if year was already promoted' })
  getPromotionStatus(
    @Param('fromYearId', new ParseUUIDPipe()) fromYearId: string,
    @Req() req: RequestWithUser,
  ) {
    const orgId = req.user.organizationId ?? '';
    return ok(
      this.promotionService.getPromotionStatus(orgId, fromYearId, req.user),
    );
  }

  @Get(':fromYearId/next-year')
  @AllowPendingOrg()
  @Permission(PermissionKey.VIEW_RESULTS, PermissionKey.MANAGE_STUDENTS)
  @CacheTTL(0)
  @ApiOperation({ summary: 'Get immediate next academic year (for promotion UI)' })
  getNextYear(
    @Param('fromYearId', new ParseUUIDPipe()) fromYearId: string,
    @Req() req: RequestWithUser,
  ) {
    const orgId = req.user.organizationId ?? '';
    return ok(this.promotionService.getNextAcademicYear(orgId, fromYearId));
  }
}
