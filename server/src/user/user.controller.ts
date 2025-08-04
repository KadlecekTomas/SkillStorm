import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UsePipes(new ValidationPipe())
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users (without password hash)' })
  @UseGuards(AuthGuard('jwt'))
  async findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (without password hash)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @UseGuards(AuthGuard('jwt'))
  async findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @UseGuards(AuthGuard('jwt'))
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user by ID' })
  @UseGuards(AuthGuard('jwt'))
  @ApiParam({ name: 'id', description: 'User ID' })
  async remove(@Param('id') id: string) {
    return this.userService.delete(id);
  }
}
