"use client";

import type { JSX } from "react";
import { useParams } from "next/navigation";
import { withGuard } from "@/lib/guard/withGuard";
import type { OrganizationRole } from "@/types";
import { LiveBoard } from "@/components/live-sessions/live-board";

/**
 * Projekční obrazovka Bleskovky — fullscreen (focus group, bez chrome).
 * Běží pod přihlášeným UČITELEM (host session); žák sem přístup nemá,
 * takže projekce nikdy nevyžaduje žákovské přihlášení.
 */
function LiveBoardPage(): JSX.Element | null {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId;
  if (!sessionId) return null;
  return <LiveBoard sessionId={sessionId} />;
}

const teacherRoles: OrganizationRole[] = ["TEACHER", "DIRECTOR", "OWNER"];

export default withGuard({
  requireRoles: teacherRoles,
  requireSchoolWorkspace: true,
})(LiveBoardPage);
