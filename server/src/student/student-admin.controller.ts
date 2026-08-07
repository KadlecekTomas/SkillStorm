import { Body, Controller, Param, ParseUUIDPipe, Patch, Req } from '@nestjs/common';
import { PermissionKey } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';
import type { RequestWithUser } from '@/types/request-with-user';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import {
  OrgOperation,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';
import { AdminUpdateStudentDto } from './dto/admin-update-student.dto';
import { StudentAdminService } from './student-admin.service';

@Controller('students')
@OrgOperation(OrgOperationType.AUTHORING)
@NoHttpCache()
export class StudentAdminController {
  constructor(private readonly studentAdmin: StudentAdminService) {}

  @Patch(':id/profile')
  @Permission(PermissionKey.MANAGE_STUDENTS)
  updateProfile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminUpdateStudentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.studentAdmin.updateProfile(id, dto, req.user);
  }
}
