import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { $Enums } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@Controller('users')
@ApiTags('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles($Enums.SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get all users (SUPERADMIN only)' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (self or SUPERADMIN)' })
  async findOne(@Param('id') id: string, @Req() req) {
    const isSelf = req.user.userId === id;
    const isSuperadmin = req.user.systemRole === 'SUPERADMIN';

    if (!isSelf && !isSuperadmin) {
      throw new ForbiddenException('Můžeš zobrazit pouze svůj vlastní účet.');
    }

    return this.usersService.findOne(id);
  }

  @Post()
  @Roles($Enums.SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Create user (SUPERADMIN only)' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user (self or SUPERADMIN)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req,
  ) {
    const isSelf = req.user.userId === id;
    const isSuperadmin = req.user.systemRole === 'SUPERADMIN';

    if (!isSelf && !isSuperadmin) {
      throw new ForbiddenException('Můžeš upravit pouze svůj vlastní účet.');
    }

    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete user (only SUPERADMIN or DIRECTOR of same org)',
  })
  @Roles($Enums.SystemRole.SUPERADMIN, $Enums.OrganizationRole.DIRECTOR)
  async remove(@Param('id') id: string, @Req() req) {
    const isSuperadmin = req.user.systemRole === 'SUPERADMIN';

    if (isSuperadmin) {
      return this.usersService.remove(id);
    }

    // Musí být DIRECTOR a ve stejné organizaci
    const targetUser = await this.usersService.findOne(id);

    const hasSameOrg =
      req.user.organizationRole === 'DIRECTOR' &&
      req.user.organizationId === targetUser.memberships?.[0]?.organizationId;

    if (!hasSameOrg) {
      throw new ForbiddenException('Nemáš oprávnění smazat tohoto uživatele.');
    }

    return this.usersService.remove(id);
  }
}
