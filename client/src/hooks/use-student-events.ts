"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";

type StudentJoinedPayload = {
  organizationId: string;
  classSectionId?: string;
  yearId?: string;
  membershipId: string;
};

type SseMessage =
  | { type: "student:joined"; payload: StudentJoinedPayload }

type UseStudentEventsOptions = {
  /** Called when a student:joined event arrives for the current org. */
  onStudentJoined?: (payload: StudentJoinedPayload) => void;
  /** Set to false to disable the connection (e.g. when teacher has no org yet). */
  enabled?: boolean;
};

/**
 * Opens a Server-Sent Events connection to GET /events/students?orgId=<orgId>.
 * Calls `onStudentJoined` when a new student joins the org, allowing the caller
 * to invalidate any cached student/classroom list.
 *
 * Automatically reconnects on connection drop (EventSource built-in retry).
 * Closes cleanly on component unmount or when enabled becomes false.
 */
export function useStudentEvents({
  onStudentJoined,
  enabled = true,
}: UseStudentEventsOptions = {}): void {
  const { org, isAuthenticated } = useAuth();
  const orgId = org?.id ?? null;

  // Stable ref to callback so the effect doesn't re-run on every render
  const onStudentJoinedRef = useRef(onStudentJoined);
  onStudentJoinedRef.current = onStudentJoined;

  useEffect(() => {
    if (!enabled || !isAuthenticated || !orgId) return;

    const url = `/api-proxy/events/students?orgId=${encodeURIComponent(orgId)}`;
    const source = new EventSource(url, { withCredentials: true });

    source.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as SseMessage;
        if (msg.type === "student:joined") {
          onStudentJoinedRef.current?.(msg.payload);
        }
      } catch {
        // Ignore malformed frames
      }
    };

    source.onerror = () => {
      // EventSource reconnects automatically; no explicit handling needed.
    };

    return () => {
      source.close();
    };
  }, [enabled, isAuthenticated, orgId]);
}
