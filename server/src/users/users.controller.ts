// src/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RequestWithUser } from '@/types/request-with-user';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';

import { OrganizationRole, SystemRole } from '@prisma/client';
import { InvalidateScopes } from '@/common/cache/invalidate.decorator';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import { Permission } from '@/modules/rbac/permission.decorator';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';

@ApiTags('users')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // -------- LIST (SUPERADMIN: všichni; DIRECTOR: jen jeho org) --------
  @Get()
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({
    summary: 'List users (search, filters, pagination, sorting)',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'search', required: false, example: 'john' })
  @CacheTTL(0)
  findAll(@Req() req: RequestWithUser, @Query() q: QueryUsersDto) {
    // služba sama vyhodnotí scope (ALL pro superadmina, jinak org-scoped)
    return ok(this.usersService.findAllQuery(req.user, q));
  }

  // -------- DETAIL (self nebo SUPERADMIN) --------
  @Get(':id')
  @NoHttpCache()
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    const isSelf = req.user.userId === id;
    const isSuperadmin = req.user.systemRole === 'SUPERADMIN';
    if (!isSelf && !isSuperadmin) {
      throw new ForbiddenException('Můžeš zobrazit pouze svůj vlastní účet.');
    }
    return ok(this.usersService.findOneSafe(id));
  }

  // -------- CREATE (SUPERADMIN) --------
  @Post()
  @Permission(SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Create user (SUPERADMIN only)' })
  @InvalidateScopes(({ result }) =>
    // očekává se, že service vrátí { affectedOrgIds: string[] } pokud rovnou vzniklo členství
    Array.isArray(result?.affectedOrgIds) ? result.affectedOrgIds : ['ALL'],
  )
  create(@Body() dto: CreateUserDto) {
    return ok(this.usersService.create(dto));
  }

  // -------- UPDATE (self nebo SUPERADMIN) --------
  @Patch(':id')
  @ApiOperation({ summary: 'Update user (self or SUPERADMIN)' })
  @InvalidateScopes(({ result, req }) => {
    // invaliduj všechny org scopy, kterých se změna týká
    if (Array.isArray(result?.affectedOrgIds) && result.affectedOrgIds.length) {
      return result.affectedOrgIds;
    }
    // fallback: když self → invaliduj aspoň scope aktuální org uživatele
    const fallbackOrg = req?.user?.organizationId;
    return fallbackOrg ? [fallbackOrg] : ['ALL'];
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: RequestWithUser,
  ) {
    const isSelf = req.user.userId === id;
    const isSuperadmin = req.user.systemRole === 'SUPERADMIN';
    if (!isSelf && !isSuperadmin) {
      throw new ForbiddenException('Můžeš upravit pouze svůj vlastní účet.');
    }
    // doporučení: usersService.update vracej { user, affectedOrgIds }
    return ok(
      this.usersService.update(id, dto, {
        requesterIsSuperadmin: isSuperadmin,
        requesterId: req.user.userId,
      }),
    );
  }

  // -------- DELETE/ANONYMIZE (SUPERADMIN nebo DIRECTOR v téže org; nikdy ne mazat superadmina) --------
  @Delete(':id')
  @Permission(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({
    summary:
      'Delete/anonymize user (SUPERADMIN or DIRECTOR of same org, not superadmin target)',
  })
  @InvalidateScopes(({ result, req }) => {
    // invaliduj všechny organizace, kterých se smazání dotklo (např. membershipy)
    if (Array.isArray(result?.affectedOrgIds) && result.affectedOrgIds.length) {
      return result.affectedOrgIds;
    }
    const fallbackOrg = req?.user?.organizationId;
    return fallbackOrg ? [fallbackOrg] : ['ALL'];
  })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    // doporučení: usersService.remove vracej { ok: true, affectedOrgIds: [...] }
    return ok(this.usersService.remove(id, req.user));
  }
}
