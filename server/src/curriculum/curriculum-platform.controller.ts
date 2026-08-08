import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AllowAnyOrgStatus } from '@/common/decorators/allow-any-org-status.decorator';
import {
  PlatformAccessLevel,
  RequirePlatformAccess,
} from '@/common/decorators/platform-access.decorator';
import { PlatformAccessGuard } from '@/common/guards/platform-access.guard';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { ok } from '@/common/http/envelope';
import type { RequestWithUser } from '@/types/request-with-user';
import { CurriculumService } from './curriculum.service';
import {
  CreateCurriculumFrameworkDto,
  FrameworkReleaseImportDto,
} from './dto/curriculum.dto';

@ApiTags('Platform Curriculum')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('platform/curriculum')
@AllowAnyOrgStatus()
@UseGuards(JwtAuthGuard, PlatformAccessGuard)
@RequirePlatformAccess(PlatformAccessLevel.READ)
export class CurriculumPlatformController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get('frameworks')
  @ApiOperation({ summary: 'List canonical curriculum frameworks and releases' })
  listFrameworks() {
    return ok(this.curriculum.listFrameworks());
  }

  @Post('frameworks')
  @RequirePlatformAccess(PlatformAccessLevel.MUTATION)
  @ApiOperation({ summary: 'Create a canonical curriculum framework' })
  createFramework(
    @Body() dto: CreateCurriculumFrameworkDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.curriculum.createFramework(dto, req.user));
  }

  @Post('frameworks/:code/releases/dry-run')
  @RequirePlatformAccess(PlatformAccessLevel.MUTATION)
  @ApiOperation({
    summary: 'Validate and diff a framework release without persisting it',
  })
  dryRunRelease(
    @Param('code') code: string,
    @Body() dto: FrameworkReleaseImportDto,
  ) {
    return ok(this.curriculum.dryRunFrameworkImport(code, dto));
  }

  @Post('frameworks/:code/releases')
  @RequirePlatformAccess(PlatformAccessLevel.MUTATION)
  @ApiOperation({ summary: 'Import an immutable canonical framework snapshot' })
  importRelease(
    @Param('code') code: string,
    @Body() dto: FrameworkReleaseImportDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.curriculum.importFrameworkRelease(code, dto, req.user));
  }

  @Get('releases/:id')
  @ApiOperation({ summary: 'Read one canonical framework release with structure' })
  getRelease(@Param('id', new ParseUUIDPipe()) id: string) {
    return ok(this.curriculum.getFrameworkRelease(id));
  }

  @Post('releases/:id/verify')
  @RequirePlatformAccess(PlatformAccessLevel.MUTATION)
  @ApiOperation({ summary: 'Verify and freeze an imported framework release' })
  verifyRelease(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.curriculum.verifyFrameworkRelease(id, req.user));
  }

  @Post('releases/:id/supersede')
  @RequirePlatformAccess(PlatformAccessLevel.MUTATION)
  @ApiOperation({ summary: 'Mark a verified framework release as superseded' })
  supersedeRelease(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.curriculum.supersedeFrameworkRelease(id, req.user));
  }
}
