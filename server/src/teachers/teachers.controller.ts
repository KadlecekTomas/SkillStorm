import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { OrganizationRole } from '@prisma/client';
import { TeachersService } from './teachers.service';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get('dashboard')
  @ApiBearerAuth()
  @Roles(OrganizationRole.DIRECTOR, OrganizationRole.TEACHER)
  async getDashboard() {
    return this.teachersService.getDashboard();
  }
}
