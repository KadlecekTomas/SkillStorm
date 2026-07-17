"use client";

import type { JSX } from "react";
import { useParams } from "next/navigation";
import { withGuard } from "@/lib/guard/withGuard";
import type { OrganizationRole } from "@/types";
import { CampaignBoard } from "@/components/campaigns/campaign-board";

/**
 * Kampaňová projekce (mapa Výpravy / nástěnka Mise) — fullscreen, bez chrome.
 * Učitel ji může promítnout kdykoli (rekapitulace před další kapitolou).
 * Stejný guard jako projekce bleskovky: TEACHER+, žádný žákovský přístup.
 */
function CampaignBoardPage(): JSX.Element | null {
  const params = useParams<{ progressId: string }>();
  const progressId = params?.progressId;
  if (!progressId) return null;
  return <CampaignBoard progressId={progressId} />;
}

const teacherRoles: OrganizationRole[] = ["TEACHER", "DIRECTOR", "OWNER"];

export default withGuard({
  requireRoles: teacherRoles,
  requireSchoolWorkspace: true,
})(CampaignBoardPage);
