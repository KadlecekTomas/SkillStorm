// src/tests/tests.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SystemRole, OrganizationRole } from '@prisma/client';
import { CacheTTL } from '@nestjs/cache-manager';
import { InvalidateScopes } from 'src/common/cache/invalidate.decorator';

import { TestsService } from './tests.service';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { QueryTestsDto } from './dto/query-tests.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import { CreateOptionDto } from './dto/create-option.dto';
import { UpdateOptionDto } from './dto/update-option.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';

@ApiTags('Tests')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('tests')
export class TestsController {
  constructor(private readonly service: TestsService) {}

  // TESTS ------------------------------------------------
  @Post()
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Create test' })
  @InvalidateScopes(({ req }) => [req.body?.organizationId].filter(Boolean))
  create(@Body() dto: CreateTestDto, @Request() req) {
    return this.service.create(dto, req.user);
  }

  @Get()
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
    OrganizationRole.STUDENT,
  )
  @ApiOperation({ summary: 'List tests' })
  @ApiQuery({ name: 'organizationId', required: false, type: String })
  @CacheTTL(0)
  findAll(@Request() req, @Query() q: QueryTestsDto) {
    return this.service.findAll(req.user, q);
  }

  @Get(':id')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
    OrganizationRole.STUDENT,
  )
  @ApiOperation({ summary: 'Get test detail' })
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
  @ApiOperation({ summary: 'Update test' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTestDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(SystemRole.SUPERADMIN, OrganizationRole.DIRECTOR)
  @ApiOperation({ summary: 'Soft delete test' })
  @InvalidateScopes(({ result }) =>
    result?.organizationId ? [result.organizationId] : [],
  )
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.service.remove(id, req.user);
  }

  // QUESTIONS -------------------------------------------

  // Reorder MUSÍ být nad ':id/questions/:questionId'
  @Patch(':id/questions/reorder')
  @Patch(':id/questions/reorder')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Reorder questions' })
  reorderQuestions(
    @Param('id', new ParseUUIDPipe()) testId: string,
    @Body() dto: ReorderQuestionsDto,
    @Request() req,
  ) {
    return this.service.reorderQuestions(testId, dto, req.user);
  }

  @Post(':id/questions')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Add question to test' })
  addQuestion(
    @Param('id', new ParseUUIDPipe()) testId: string,
    @Body() dto: CreateQuestionDto,
    @Request() req,
  ) {
    return this.service.addQuestion(testId, dto, req.user);
  }

  @Patch(':id/questions/:questionId([0-9a-fA-F-]{36})')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Update question' })
  updateQuestion(
    @Param('id', new ParseUUIDPipe()) testId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Body() dto: UpdateQuestionDto,
    @Request() req,
  ) {
    return this.service.updateQuestion(testId, questionId, dto, req.user);
  }

  @Delete(':id/questions/:questionId([0-9a-fA-F-]{36})')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  @ApiOperation({ summary: 'Remove question' })
  removeQuestion(
    @Param('id', new ParseUUIDPipe()) testId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Request() req,
  ) {
    return this.service.removeQuestion(testId, questionId, req.user);
  }

  // OPTIONS ---------------------------------------------
  @Post(':id/questions/:questionId([0-9a-fA-F-]{36})/options')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  addOption(
    @Param('id', new ParseUUIDPipe()) testId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Body() dto: CreateOptionDto,
    @Request() req,
  ) {
    return this.service.addOption(testId, questionId, dto, req.user);
  }

  @Patch(
    ':id/questions/:questionId([0-9a-fA-F-]{36})/options/:optionId([0-9a-fA-F-]{36})',
  )
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  updateOption(
    @Param('id', new ParseUUIDPipe()) testId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Param('optionId', new ParseUUIDPipe()) optionId: string,
    @Body() dto: UpdateOptionDto,
    @Request() req,
  ) {
    return this.service.updateOption(
      testId,
      questionId,
      optionId,
      dto,
      req.user,
    );
  }

  @Delete(
    ':id/questions/:questionId([0-9a-fA-F-]{36})/options/:optionId([0-9a-fA-F-]{36})',
  )
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  removeOption(
    @Param('id', new ParseUUIDPipe()) testId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Param('optionId', new ParseUUIDPipe()) optionId: string,
    @Request() req,
  ) {
    return this.service.removeOption(testId, questionId, optionId, req.user);
  }

  // ANSWERS (správné odpovědi) --------------------------
  @Post(':id/questions/:questionId([0-9a-fA-F-]{36})/answers')
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  addAnswer(
    @Param('id', new ParseUUIDPipe()) testId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Body() dto: CreateAnswerDto,
    @Request() req,
  ) {
    return this.service.addAnswer(testId, questionId, dto, req.user);
  }

  @Patch(
    ':id/questions/:questionId([0-9a-fA-F-]{36})/answers/:answerId([0-9a-fA-F-]{36})',
  )
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  updateAnswer(
    @Param('id', new ParseUUIDPipe()) testId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Param('answerId', new ParseUUIDPipe()) answerId: string,
    @Body() dto: UpdateAnswerDto,
    @Request() req,
  ) {
    return this.service.updateAnswer(
      testId,
      questionId,
      answerId,
      dto,
      req.user,
    );
  }

  @Delete(
    ':id/questions/:questionId([0-9a-fA-F-]{36})/answers/:answerId([0-9a-fA-F-]{36})',
  )
  @Roles(
    SystemRole.SUPERADMIN,
    OrganizationRole.DIRECTOR,
    OrganizationRole.TEACHER,
  )
  removeAnswer(
    @Param('id', new ParseUUIDPipe()) testId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Param('answerId', new ParseUUIDPipe()) answerId: string,
    @Request() req,
  ) {
    return this.service.removeAnswer(testId, questionId, answerId, req.user);
  }
}
