"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PartakEmblem } from "@/components/partak";
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

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Vlastník",
  DIRECTOR: "Ředitel",
  TEACHER: "Učitel",
  STUDENT: "Žák",
  PARENT: "Rodič",
};

/** Role-deterministic dashboard title. No manual switching, derived only from the active role. */
function getDashboardTitle(
  context: { mode?: string } | null,
  organizationRole: string | undefined,
): string {
  if (context?.mode === "platform") return "Platform";
  if (context?.mode === "personal") return "Přehled";
  switch (organizationRole) {
    case "STUDENT":
      return "Moje zadání";
    case "PARENT":
      return "Rodinný prostor";
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
  const { user, org, logout, switchOrganization, switchRole, activeRole, isLoading, context } =
    useAuth();
  const memberships = user?.memberships ?? [];
  const activeMembership = memberships.find((m) => m.organizationId === org?.id);
  const activeMembershipId = activeMembership?.id ?? "";
  const role = activeRole ?? user?.organizationRole ?? "";
  const title = getDashboardTitle(context, role);
  // Multi-role (guardian Etapa A): přepínač kontextu se ukáže jen členům
  // s více přiřazenými rolemi v aktivní organizaci.
  const availableRoles = activeMembership?.roles ?? [];
  const showRoleSwitcher =
    context?.mode === "organization" && availableRoles.length > 1;

  const showBetaBadge = process.env.NEXT_PUBLIC_BETA_MODE === "1";
  const canReportIssue =
    context?.mode === "organization" &&
    (role === "TEACHER" || role === "DIRECTOR" || role === "OWNER");

  return (
    <div
      data-app-chrome
      className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4"
    >
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/app" className="flex items-center gap-2 text-ink md:hidden" aria-label="SkillStorm — přehled">
          <PartakEmblem size={26} />
          <span className="text-base font-extrabold tracking-[-.01em]">SkillStorm</span>
        </Link>
        <p className="text-lg font-semibold text-ink-muted">{title}</p>
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
        {showRoleSwitcher ? (
          <Select
            value={role}
            onValueChange={(value) => {
              if (value && value !== role) {
                void switchRole(value as (typeof availableRoles)[number]);
              }
            }}
            disabled={isLoading}
          >
            <SelectTrigger className="w-40 rounded-2xl" aria-label="Aktivní role">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((availableRole) => (
                <SelectItem key={availableRole} value={availableRole}>
                  {ROLE_LABELS[availableRole] ?? availableRole.toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          role && (
            <Badge variant="secondary" className="capitalize">
              {ROLE_LABELS[role] ?? role.toLowerCase()}
            </Badge>
          )
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
