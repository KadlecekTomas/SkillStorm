import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    // 1) už je to HttpException → vrať jak je
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      return res
        .status(status)
        .json(typeof response === 'string' ? { message: response } : response);
    }

    // 2) Zod → 400
    if (exception instanceof ZodError) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Validation failed',
        issues: exception.issues,
      });
    }

    // 3) Prisma → známe kódy na 400/409/404
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const code = exception.code;
      if (code === 'P2002') {
        return res.status(HttpStatus.CONFLICT).json({
          statusCode: 409,
          message: 'Unique constraint failed',
          meta: exception.meta,
        });
      }
      if (code === 'P2003') {
        return res.status(HttpStatus.BAD_REQUEST).json({
          statusCode: 400,
          message: 'Foreign key constraint failed',
          meta: exception.meta,
        });
      }
      if (code === 'P2025') {
        return res.status(HttpStatus.NOT_FOUND).json({
          statusCode: 404,
          message: 'Record not found',
          meta: exception.meta,
        });
      }
    }

    // 4) fallback → 500
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: 'Internal Server Error',
      error: String(exception?.message ?? exception),
    });
  }
}
