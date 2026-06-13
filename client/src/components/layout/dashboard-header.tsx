"use client";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserMenu } from "@/components/layout/user-menu";
import { useAuth } from "@/hooks/use-auth";
import { ReportIssueButton } from "@/components/support/report-issue-button";

/** Role-deterministic dashboard title. No manual switching, derived only from membership.role. */
function getDashboardTitle(
  context: { mode?: string } | null,
  organizationRole: string | undefined,
): string {
  if (context?.mode === "platform") return "Platform";
  if (context?.mode === "personal") return "Přehled";
  switch (organizationRole) {
    case "STUDENT":
      return "Moje zadání";
    case "TEACHER":
      return "Moje testy";
    case "DIRECTOR":
    case "OWNER":
      return "Přehled školy";
    default:
      return "Přehled";
  }
}

/**
 * Global dashboard header: Logout, org switcher, role badge.
 * Rendered OUTSIDE AppReadinessGate so Logout is always visible (including platform routes).
 * Mode is derived ONLY from membership.role; no experience toggle.
 */
export function DashboardHeader(): React.JSX.Element {
  const { user, org, logout, switchOrganization, isLoading, context } = useAuth();
  const memberships = user?.memberships ?? [];
  const activeMembershipId =
    memberships.find((m) => m.organizationId === org?.id)?.id ?? "";
  const role = user?.organizationRole ?? "";
  const title = getDashboardTitle(context, role);

  const showBetaBadge = process.env.NEXT_PUBLIC_BETA_MODE === "1";
  const canReportIssue =
    context?.mode === "organization" &&
    (role === "TEACHER" || role === "DIRECTOR" || role === "OWNER");

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-dashed border-slate-200 bg-white/70 px-6 py-4">
      <div className="flex flex-wrap items-baseline gap-4">
        <p className="text-lg font-semibold text-slate-900">{title}</p>
        {showBetaBadge && (
          <span
            className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
            aria-label="Closed beta"
          >
            BETA
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {memberships.length > 1 && (
          <Select
            value={activeMembershipId}
            onValueChange={(value) => {
              if (value && value !== activeMembershipId) {
                void switchOrganization(value);
              }
            }}
            disabled={isLoading}
          >
            <SelectTrigger className="w-52 rounded-2xl" aria-label="Organization">
              <SelectValue placeholder="Vyber školu" />
            </SelectTrigger>
            <SelectContent>
              {memberships.map((membership) => (
                <SelectItem key={membership.id} value={membership.id}>
                  {membership.organization?.name ?? membership.organizationId}
                  {membership.role ? ` (${membership.role.toLowerCase()})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {role && (
          <Badge variant="success" className="capitalize">
            {role.toLowerCase()}
          </Badge>
        )}
        {canReportIssue && <ReportIssueButton compact />}
        <UserMenu
          displayName={user?.fullName ?? user?.name ?? "Uživatel"}
          avatarUrl={user?.avatarUrl ?? null}
          onLogout={() => void logout()}
        />
      </div>
    </div>
  );
}
