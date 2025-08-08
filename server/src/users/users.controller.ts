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
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { $Enums } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { QueryUsersDto } from './dto/query-users.dto';

@ApiTags('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles($Enums.SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get all users (SUPERADMIN only)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'search', required: false, example: 'john' })
  @Get()
  @Roles($Enums.SystemRole.SUPERADMIN, $Enums.OrganizationRole.DIRECTOR)
  @ApiOperation({
    summary: 'List users (search, filters, pagination, sorting)',
  })
  findAll(@Req() req: any, @Query() q: QueryUsersDto) {
    return this.usersService.findAllQuery(req.user, q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (self or SUPERADMIN)' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    const isSelf = req.user.userId === id;
    const isSuperadmin = req.user.systemRole === 'SUPERADMIN';
    if (!isSelf && !isSuperadmin) {
      throw new ForbiddenException('Můžeš zobrazit pouze svůj vlastní účet.');
    }
    return this.usersService.findOneSafe(id);
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
    @Req() req: any,
  ) {
    const isSelf = req.user.userId === id;
    const isSuperadmin = req.user.systemRole === 'SUPERADMIN';
    if (!isSelf && !isSuperadmin) {
      throw new ForbiddenException('Můžeš upravit pouze svůj vlastní účet.');
    }
    return this.usersService.update(id, dto, {
      requesterIsSuperadmin: isSuperadmin,
      requesterId: req.user.userId,
    });
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Delete/anonymize user (SUPERADMIN or DIRECTOR of same org, not superadmin target)',
  })
  @Roles($Enums.SystemRole.SUPERADMIN, $Enums.OrganizationRole.DIRECTOR)
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.usersService.remove(id, req.user);
  }
}
