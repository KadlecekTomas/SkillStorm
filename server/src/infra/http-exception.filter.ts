import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    // 1) HttpException → return as-is, but 429 uses generic message (no leak)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const body =
        status === 429
          ? { statusCode: 429, message: 'Operace se nezdařila.' }
          : typeof response === 'string'
            ? { message: response }
            : response;
      return res.status(status).json(body);
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
        const metaText = JSON.stringify(exception.meta ?? {}).toLowerCase();
        const isYearMismatchConstraint =
          metaText.includes('class_section_id') &&
          metaText.includes('academic_year_id');
        if (isYearMismatchConstraint) {
          return res.status(HttpStatus.CONFLICT).json({
            statusCode: 409,
            errorCode: 'YEAR_MISMATCH',
            message: 'Year invariant violation',
          });
        }
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
