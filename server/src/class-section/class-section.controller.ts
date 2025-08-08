import {
  Body,
  Controller,
  Param,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { SetHomeroomDto } from './dto/set-homeroom.dto';
import { ClassSectionService } from './class-section.service';

@ApiTags('ClassSections')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('class-sections')
export class ClassSectionController {
  constructor(private readonly service: ClassSectionService) {}

  @Patch(':id/homeroom')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Nastavit/odstranit třídnictví (homeroom teacher)' })
  setHomeroom(
    @Param('id') classSectionId: string,
    @Body() dto: SetHomeroomDto,
    @Request() req,
  ) {
    return this.service.setHomeroom(classSectionId, dto, req.user);
  }
}
