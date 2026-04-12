import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { PermissionKey } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';
import { RequestWithUser } from '@/types/request-with-user';
import { ok } from '@/common/http/envelope';
import { OrgOperation, OrgOperationType } from '@/common/decorators/org-operation.decorator';
import { TeacherAccessService } from './teacher-access.service';
import { QueryTeacherAccessDto } from './dto/query-teacher-access.dto';
import { CreateTeacherAccessDto } from './dto/create-teacher-access.dto';
import { UpdateTeacherAccessDto } from './dto/update-teacher-access.dto';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';

@ApiTags('TeacherAccess')
@ApiBearerAuth()
@Controller('teacher-access')
@OrgOperation(OrgOperationType.AUTHORING)
export class TeacherAccessController {
  constructor(private readonly service: TeacherAccessService) {}

  @Get()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'List teacher classroom access by teacher' })
  @NoHttpCache()
  @CacheTTL(0)
  findAll(@Req() req: RequestWithUser, @Query() q: QueryTeacherAccessDto) {
    return ok(this.service.findAll(req.user, q));
  }

  @Post()
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Create teacher classroom access' })
  create(@Req() req: RequestWithUser, @Body() dto: CreateTeacherAccessDto) {
    return ok(this.service.create(dto, req.user));
  }

  @Patch(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Update teacher classroom access' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTeacherAccessDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.update(id, dto, req.user));
  }

  @Delete(':id')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Delete teacher classroom access' })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.remove(id, req.user));
  }
}
