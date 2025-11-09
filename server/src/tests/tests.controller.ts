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
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Permission } from '@/modules/rbac/permission.decorator';
import { PermissionKey } from '@prisma/client';
import { CacheTTL } from '@nestjs/cache-manager';
import { InvalidateScopes } from '@/common/cache/invalidate.decorator';

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
@Controller('tests')
export class TestsController {
  constructor(private readonly service: TestsService) {}

  // TESTS ------------------------------------------------
  @Post()
  @Permission(PermissionKey.CREATE_TEST)
  @ApiOperation({ summary: 'Create test' })
  @InvalidateScopes(({ req }) => [req.body?.organizationId].filter(Boolean))
  create(@Body() dto: CreateTestDto, @Request() req) {
    return this.service.create(dto, req.user);
  }

  @Get()
  @Permission(PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'List tests' })
  @ApiQuery({ name: 'organizationId', required: false, type: String })
  @CacheTTL(0)
  findAll(@Request() req, @Query() q: QueryTestsDto) {
    return this.service.findAll(req.user, q);
  }

  @Get(':id')
  @Permission(PermissionKey.VIEW_RESULTS)
  @ApiOperation({ summary: 'Get test detail' })
  @CacheTTL(0)
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @Request() req) {
    return this.service.findOne(id, req.user);
  }

  @Patch(':id')
  @Permission(PermissionKey.EDIT_TEST)
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
  @Permission(PermissionKey.DELETE_TEST)
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
  @Permission(PermissionKey.EDIT_TEST)
  @ApiOperation({ summary: 'Reorder questions' })
  reorderQuestions(
    @Param('id', new ParseUUIDPipe()) testId: string,
    @Body() dto: ReorderQuestionsDto,
    @Request() req,
  ) {
    return this.service.reorderQuestions(testId, dto, req.user);
  }

  @Post(':id/questions')
  @Permission(PermissionKey.EDIT_TEST)
  @ApiOperation({ summary: 'Add question to test' })
  addQuestion(
    @Param('id', new ParseUUIDPipe()) testId: string,
    @Body() dto: CreateQuestionDto,
    @Request() req,
  ) {
    return this.service.addQuestion(testId, dto, req.user);
  }

  @Patch(':id/questions/:questionId([0-9a-fA-F-]{36})')
  @Permission(PermissionKey.EDIT_TEST)
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
  @Permission(PermissionKey.EDIT_TEST)
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
  @Permission(PermissionKey.EDIT_TEST)
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
  @Permission(PermissionKey.EDIT_TEST)
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
  @Permission(PermissionKey.EDIT_TEST)
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
  @Permission(PermissionKey.EDIT_TEST)
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
  @Permission(PermissionKey.EDIT_TEST)
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
  @Permission(PermissionKey.EDIT_TEST)
  removeAnswer(
    @Param('id', new ParseUUIDPipe()) testId: string,
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Param('answerId', new ParseUUIDPipe()) answerId: string,
    @Request() req,
  ) {
    return this.service.removeAnswer(testId, questionId, answerId, req.user);
  }
}
