import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export const ApiStandardResponses = (example: Record<string, any> = {}) =>
  applyDecorators(
    ApiResponse({
      status: 200,
      description: 'Success',
      schema: { example: { success: true, data: example || {} } },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request',
      schema: { example: { success: false, error: 'Bad Request' } },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized',
      schema: { example: { success: false, error: 'Unauthorized' } },
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden',
      schema: { example: { success: false, error: 'Forbidden' } },
    }),
    ApiResponse({
      status: 404,
      description: 'Not Found',
      schema: { example: { success: false, error: 'Not Found' } },
    }),
  );
