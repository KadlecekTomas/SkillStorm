import type { Request } from 'express';
import type { JwtPayload } from '@/auth/types/jwt-payload';

export type RequestWithUser = Request & { user: JwtPayload };
