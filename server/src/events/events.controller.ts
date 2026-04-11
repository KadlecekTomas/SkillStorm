import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RequestWithUser } from '@/types/request-with-user';
import { Sse } from '@nestjs/common';
import { OrgOperation, OrgOperationType } from '@/common/decorators/org-operation.decorator';

/**
 * Server-Sent Events controller.
 *
 * GET /events/students?orgId=<uuid>
 * Requires JWT auth. Streams student:joined events for the given organization.
 * Clients reconnect automatically via EventSource.
 *
 * Rate limit: 20 connections per 60 s per IP (inherits global throttler).
 */
@ApiTags('Events')
@Controller('events')
@OrgOperation(OrgOperationType.AUTHORING)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('students')
  @Sse()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60 } })
  @ApiOperation({ summary: 'SSE stream: student-joined events for an organization' })
  streamStudents(
    @Query('orgId') orgId: string,
    @Req() req: RequestWithUser,
    @Res() _res: Response,
  ): Observable<{ data: string }> {
    // Validate that the caller belongs to the requested org (or is SUPERADMIN)
    const callerOrgId = req.user?.organizationId ?? null;
    const isSuperAdmin = req.user?.systemRole === 'SUPERADMIN';
    const resolvedOrgId = orgId?.trim() ?? callerOrgId ?? '';

    if (!resolvedOrgId) {
      return new Observable((sub) => sub.complete());
    }
    if (!isSuperAdmin && callerOrgId !== resolvedOrgId) {
      return new Observable((sub) => sub.complete());
    }

    return this.eventsService.streamForOrg(resolvedOrgId);
  }
}
