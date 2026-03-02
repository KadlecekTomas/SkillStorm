import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export type StudentJoinedPayload = {
  organizationId: string;
  classSectionId?: string;
  yearId?: string;
  membershipId: string;
};

type SseEvent = {
  orgId: string;
  type: 'student:joined';
  data: StudentJoinedPayload;
};

@Injectable()
export class EventsService {
  /** Single broadcast channel — all orgs share one Subject, filtered per subscriber. */
  private readonly bus = new Subject<SseEvent>();

  /**
   * Emit a student-joined event for a specific organization.
   * Called by InvitesService after a successful invite accept.
   */
  emitStudentJoined(orgId: string, payload: StudentJoinedPayload): void {
    this.bus.next({ orgId, type: 'student:joined', data: payload });
  }

  /**
   * Returns an Observable of SSE MessageEvent objects for a given org.
   * Each subscriber (SSE connection) filters by their org and maps to MessageEvent shape.
   */
  streamForOrg(orgId: string) {
    return this.bus.asObservable().pipe(
      filter((ev) => ev.orgId === orgId),
      map((ev) => ({
        data: JSON.stringify({ type: ev.type, payload: ev.data }),
      })),
    );
  }
}
