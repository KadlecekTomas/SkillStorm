import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionKey } from '@prisma/client';
import { AcademicYearExpiredGuard } from '@/academic-years/academic-year-expired.guard';
import { RequireCurrentAcademicYearGuard } from '@/academic-years/require-current-academic-year.guard';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { ok } from '@/common/http/envelope';
import {
  OrgOperation,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';
import { OrgContextService } from '@/common/org-context/org-context.service';
import { Permission } from '@/modules/rbac/permission.decorator';
import { RequestWithUser } from '@/types/request-with-user';
import { ImportsService } from './imports.service';
import { StudentImportCommitDto } from './dto/student-import-commit.dto';
import { StudentImportPreviewDto } from './dto/student-import-preview.dto';

@ApiTags('Imports')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('imports/students')
@UseGuards(RequireCurrentAcademicYearGuard, AcademicYearExpiredGuard)
// Bulk student import mutates org rosters/enrollments → EXECUTION (blocked for
// NOT_READY orgs). This makes explicit the previously-implicit default the
// readiness gate already applied; behaviour is unchanged.
@OrgOperation(OrgOperationType.EXECUTION)
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly orgContext: OrgContextService,
  ) {}

  @Post('preview')
  @Permission(PermissionKey.MANAGE_STUDENTS)
  @ApiOperation({ summary: 'Preview student CSV import' })
  async preview(
    @Body() dto: StudentImportPreviewDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException('Missing active academic year.');
    }
    return ok(
      this.importsService.previewStudents(
        {
          csv: dto.csv,
          academicYearId: ctx.activeAcademicYearId,
          ...(dto.fileName ? { fileName: dto.fileName } : {}),
          ...(dto.defaultClassSectionId
            ? { defaultClassSectionId: dto.defaultClassSectionId }
            : {}),
        },
        req.user,
      ),
    );
  }

  @Post('commit')
  @Permission(PermissionKey.MANAGE_STUDENTS)
  @ApiOperation({ summary: 'Commit edited student import rows' })
  async commit(
    @Body() dto: StudentImportCommitDto,
    @Req() req: RequestWithUser,
  ) {
    const ctx = await this.orgContext.get(req);
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException('Missing active academic year.');
    }
    return ok(
      this.importsService.commitStudents(
        {
          rows: dto.rows,
          academicYearId: ctx.activeAcademicYearId,
          ...(dto.fileName ? { fileName: dto.fileName } : {}),
          ...(dto.defaultClassSectionId
            ? { defaultClassSectionId: dto.defaultClassSectionId }
            : {}),
        },
        req.user,
      ),
    );
  }
}
