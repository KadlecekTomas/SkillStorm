import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Query,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { RequestWithUser } from '@/types/request-with-user';
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
import { Express } from 'express';

import { LearningMaterialsService } from './learning-materials.service';
import { CreateLearningMaterialDto } from './dto/create-learning-material.dto';
import { UpdateLearningMaterialDto } from './dto/update-learning-material.dto';
import { QueryLearningMaterialsDto } from './dto/query-learning-materials.dto';

import { Permission } from '@/modules/rbac/permission.decorator';
import { PermissionKey } from '@prisma/client';

import { InvalidateScopes } from '@/common/cache/invalidate.decorator';
import {
  OrgOperation,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';

@ApiTags('LearningMaterials')
@ApiBearerAuth()
@Controller('learning-materials')
@OrgOperation(OrgOperationType.AUTHORING)
export class LearningMaterialsController {
  constructor(private readonly service: LearningMaterialsService) {}

  @Post()
  @Permission(PermissionKey.EDIT_TEST)
  @ApiOperation({ summary: 'Create learning material' })
  @InvalidateScopes(({ req }) => [req.body?.organizationId].filter(Boolean))
  create(@Body() dto: CreateLearningMaterialDto, @Req() req: RequestWithUser) {
    return this.service.create(dto, req.user);
  }

  @Get()
  @Permission(PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'List learning materials' })
  @ApiQuery({ name: 'organizationId', required: false, type: String })
  @CacheTTL(0)
  findAll(@Req() req: RequestWithUser, @Query() q: QueryLearningMaterialsDto) {
    return this.service.findAll(req.user, q);
  }

  @Get(':id')
  @Permission(PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'Get material detail' })
  @CacheTTL(0)
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.findOne(id, req.user);
  }

  @Patch(':id')
  @Permission(PermissionKey.EDIT_TEST)
  @ApiOperation({ summary: 'Update learning material' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateLearningMaterialDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(':id')
  @Permission(PermissionKey.DELETE_TEST)
  @ApiOperation({ summary: 'Soft delete material' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.service.remove(id, req.user);
  }

  @Post(':id/file')
  @Permission(PermissionKey.EDIT_TEST)
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
    file: Express.Multer.File,
    @Req() req: RequestWithUser,
  ) {
    return this.service.attachFile(id, file, req.user);
  }
}
