import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
} from '@nestjs/common';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';
import type { RequestWithUser } from '@/types/request-with-user';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import {
  OrgOperation,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';
import { SchoolPeopleService } from './school-people.service';
import { UpdateSchoolPersonDto } from './dto/update-school-person.dto';

@Controller('school-people')
@OrgOperation(OrgOperationType.AUTHORING)
@NoHttpCache()
export class SchoolPeopleController {
  constructor(private readonly schoolPeople: SchoolPeopleService) {}

  @Get()
  @Permission(
    SystemRole.SUPERADMIN,
    OrganizationRole.OWNER,
    OrganizationRole.DIRECTOR,
  )
  list(@Req() req: RequestWithUser) {
    return this.schoolPeople.list(req.user);
  }

  @Patch(':membershipId')
  @Permission(
    SystemRole.SUPERADMIN,
    OrganizationRole.OWNER,
    OrganizationRole.DIRECTOR,
  )
  update(
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Body() dto: UpdateSchoolPersonDto,
    @Req() req: RequestWithUser,
  ) {
    return this.schoolPeople.update(membershipId, dto, req.user);
  }
}
