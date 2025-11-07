import {
  Body,
  Controller,
  Param,
  Patch,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { SetHomeroomDto } from './dto/set-homeroom.dto';
import { ClassSectionService } from './class-section.service';
import { InvalidateScopes } from 'src/common/cache/invalidate.decorator';
import { Permission } from 'src/modules/rbac/permission.decorator';

@ApiTags('ClassSections')
@ApiBearerAuth()
@Controller('class-sections')
export class ClassSectionController {
  constructor(private readonly service: ClassSectionService) {}

  @Patch(':id/homeroom')
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Nastavit/odstranit třídnictví (homeroom teacher)' })
  // invaliduj org-scoped cache (vezmeme org z vráceného záznamu; fallback = org z req)
  @InvalidateScopes(({ result, req }) =>
    [result?.academicYear?.orgId ?? req?.user?.organizationId].filter(Boolean),
  )
  setHomeroom(
    @Param('id', new ParseUUIDPipe()) classSectionId: string,
    @Body() dto: SetHomeroomDto,
    @Request() req,
  ) {
    return this.service.setHomeroom(classSectionId, dto, req.user);
  }
}
