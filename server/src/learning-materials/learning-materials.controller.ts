import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParseFilePipe, MaxFileSizeValidator } from '@nestjs/common';

import { LearningMaterialsService } from './learning-materials.service';
import { CreateLearningMaterialDto } from './dto/create-learning-material.dto';
import { UpdateLearningMaterialDto } from './dto/update-learning-material.dto';
import { QueryLearningMaterialsDto } from './dto/query-learning-materials.dto';

import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { SystemRole, OrganizationRole } from '@prisma/client';

import { InvalidateScopes } from 'src/common/cache/invalidate.decorator';
import type { File as MulterFile } from 'multer';

@ApiTags('LearningMaterials')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('learning-materials')
export class LearningMaterialsController {
  constructor(private readonly service: LearningMaterialsService) {}

  @Post()
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Create learning material' })
  @InvalidateScopes(({ req }) => [req.body?.organizationId].filter(Boolean))
  create(@Body() dto: CreateLearningMaterialDto, @Request() req) {
    return this.service.create(dto, req.user);
  }

  @Get()
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
    OrganizationRole.STUDENT,
  )
  @ApiOperation({ summary: 'List learning materials' })
  @ApiQuery({ name: 'organizationId', required: false, type: String })
  @CacheTTL(0)
  findAll(@Request() req, @Query() q: QueryLearningMaterialsDto) {
    return this.service.findAll(req.user, q);
  }

  @Get(':id')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
    OrganizationRole.STUDENT,
  )
  @ApiOperation({ summary: 'Get material detail' })
  @CacheTTL(0)
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.service.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Update learning material' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateLearningMaterialDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Soft delete material' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.service.remove(id, req.user);
  }

  @Post(':id/file')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Upload PDF file for material' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  upload(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 25 * 1024 * 1024 })],
      }),
    )
    file: MulterFile,
    @Request() req,
  ) {
    return this.service.attachFile(id, file, req.user);
  }
}
