import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestWithUser } from '@/types/request-with-user';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    if (!req.user?.isPlatformAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN_PLATFORM_ADMIN_ONLY',
        message: 'Platform admin access required',
      });
    }
    return true;
  }
}
