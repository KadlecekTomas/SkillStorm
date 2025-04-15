import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtMiddleware } from './jwt.middleware';

export function JwtAuth() {
  return applyDecorators(UseGuards(JwtMiddleware));
}
