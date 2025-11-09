// src/modules/classroom/class-sections.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { PermissionKey } from '@prisma/client';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import { SetHomeroomDto } from './dto/set-homeroom.dto';
import { ClassSectionsService } from './class-sections.service';
import { InvalidateScopes } from '@/common/cache/invalidate.decorator';
import { Permission } from '@/modules/rbac/permission.decorator';

@ApiTags('ClassSections')
@ApiBearerAuth()
@Controller('class-sections')
export class ClassSectionsController {
  constructor(private readonly service: ClassSectionsService) {}

  @Post()
  async create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail třídy' })
  @CacheTTL(0)
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.service.findOne(id, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Úprava třídy' })
  @InvalidateScopes(({ result }) => (result?.orgId ? [result.orgId] : []))
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateClassroomDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Smazání třídy' })
  @InvalidateScopes(({ result }) => (result?.orgId ? [result.orgId] : []))
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.service.remove(id, req.user);
  }

  @Patch(':id/homeroom')
  @Permission(PermissionKey.MANAGE_TEACHERS)
  @ApiOperation({ summary: 'Nastavit/odstranit třídnictví (homeroom teacher)' })
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
