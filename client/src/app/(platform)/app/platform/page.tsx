"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { httpClient } from "@/lib/http/client";
import { showHttpErrorToastOnce } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Activity,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrgSignals = {
  totalTeachers: number;
  totalStudents: number;
  activeCreators30d: number;
  activeGraders30d: number;
  activeSubmitters30d: number;
  testsCreated30d: number;
};

type OrgHealthSummary = {
  organizationId: string;
  organizationName: string;
  score: number;
  deltaScore: number;
  trendLabel: "UP" | "DOWN" | "FLAT";
  signals: OrgSignals;
};

type PlatformAnalyticsOverview = {
  totalOrganizations: number;
  activeOrganizationsLast30Days: number;
  averageHealthScore: number;
  lowHealthOrganizations: OrgHealthSummary[];
  topOrganizations: OrgHealthSummary[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function scoreBadgeCls(score: number): string {
  if (score >= 80) return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (score >= 50) return "bg-amber-50 border-amber-200 text-amber-700";
  return "bg-red-50 border-red-200 text-red-600";
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${scoreBadgeCls(score)}`}
    >
      {score}
    </span>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta >= 5) {
    return (
      <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700">
        ▲ +{delta}
      </span>
    );
  }
  if (delta <= -5) {
    return (
      <span className="inline-flex items-center rounded bg-red-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-600">
        ▼ {delta}
      </span>
    );
  }
  return <span className="font-mono text-[10px] text-gray-400">—</span>;
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

type KpiCardProps = {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  valueClass?: string;
};

function KpiCard({ label, value, sub, icon, valueClass }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {label}
          </p>
          <p
            className={`mt-2 text-2xl font-semibold tabular-nums ${valueClass ?? "text-gray-900"}`}
          >
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
        </div>
        <div className="rounded-xl bg-gray-100 p-2 text-gray-500">{icon}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Health table
// ---------------------------------------------------------------------------

const TABLE_COLS = "grid-cols-[1fr_52px_48px_52px_52px_52px_52px_52px]";

function HealthTableHeader() {
  return (
    <div
      className={`grid ${TABLE_COLS} gap-2 border-b border-gray-200 px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-400`}
    >
      <span>Organization</span>
      <span>Score</span>
      <span title="Score delta vs previous 30 days">Δ</span>
      <span title="Total teachers in organization">T. tot.</span>
      <span title="Teachers who created a test in last 30 days">Tvoří</span>
      <span title="Teachers who assigned work in last 30 days">Zadávají</span>
      <span title="Students who submitted in last 30 days">Žáci</span>
      <span title="Tests created in last 30 days">Testy</span>
    </div>
  );
}

function HealthRow({
  org,
  rank,
  onClick,
}: {
  org: OrgHealthSummary;
  rank?: number;
  onClick: () => void;
}) {
  const isAtRisk = org.score < 40;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid w-full ${TABLE_COLS} cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50 ${
        isAtRisk ? "bg-red-50/50" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {rank !== undefined && (
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">
            {rank}
          </span>
        )}
        <span className="truncate font-medium text-gray-800">
          {org.organizationName}
        </span>
        {isAtRisk && (
          <span className="flex-shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
            At Risk
          </span>
        )}
      </div>
      <ScoreBadge score={org.score} />
      <DeltaBadge delta={org.deltaScore} />
      <span className="tabular-nums text-xs text-gray-500">
        {org.signals.totalTeachers}
      </span>
      <span className="tabular-nums text-xs text-gray-500">
        {org.signals.activeCreators30d}
      </span>
      <span className="tabular-nums text-xs text-gray-500">
        {org.signals.activeGraders30d}
      </span>
      <span className="tabular-nums text-xs text-gray-500">
        {org.signals.activeSubmitters30d}
      </span>
      <span className="tabular-nums text-xs text-gray-400">
        {org.signals.testsCreated30d}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PlatformOverviewPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<PlatformAnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(async (nocache = false) => {
    if (!nocache) setLoading(true);
    setError(false);
    try {
      const url = nocache
        ? "/platform/analytics/overview?nocache=1"
        : "/platform/analytics/overview";
      const data = await httpClient.get<PlatformAnalyticsOverview>(url, {
        cache: "no-store",
      });
      if (!aliveRef.current) return;
      setOverview(data);
      setLastUpdatedAt(new Date());
    } catch (err) {
      if (!aliveRef.current) return;
      showHttpErrorToastOnce(err);
      setError(true);
    } finally {
      if (aliveRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={`kpi-skel-${i}`} className="h-28 w-full rounded-xl bg-gray-200" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl bg-gray-200" />
          <Skeleton className="h-64 w-full rounded-xl bg-gray-200" />
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <p className="text-sm text-gray-500">Analytics se nepodařilo načíst.</p>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Zkusit znovu
        </Button>
      </div>
    );
  }

  const hasLowHealth = overview.lowHealthOrganizations.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Platform overview</h1>
        <div className="flex items-center gap-3">
          {lastUpdatedAt && (
            <span className="text-xs text-gray-400">
              Updated{" "}
              {lastUpdatedAt.toLocaleTimeString("cs-CZ", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={refreshing}
            onClick={() => void handleRefresh()}
            className="border-gray-300 text-gray-500 hover:text-gray-700"
            aria-label="Refresh analytics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Organizations"
          value={overview.totalOrganizations}
          icon={<Building2 className="h-4 w-4" />}
          sub="all time"
        />
        <KpiCard
          label="Active (last 30 d)"
          value={overview.activeOrganizationsLast30Days}
          icon={<Activity className="h-4 w-4" />}
          sub="at least one test or submission"
        />
        <KpiCard
          label="Avg Health Score"
          value={overview.averageHealthScore}
          icon={<TrendingUp className="h-4 w-4" />}
          valueClass={scoreColor(overview.averageHealthScore)}
          sub="across active organizations"
        />
        <KpiCard
          label="Low Health"
          value={overview.lowHealthOrganizations.length}
          icon={<AlertTriangle className="h-4 w-4" />}
          valueClass={
            overview.lowHealthOrganizations.length > 0 ? "text-red-600" : "text-gray-900"
          }
          sub="score below 40"
        />
      </div>

      {/* Low-health alert banner */}
      {hasLowHealth && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
          <p className="flex-1 text-sm text-red-700">
            <span className="font-semibold">
              {overview.lowHealthOrganizations.length}{" "}
              {overview.lowHealthOrganizations.length === 1 ? "organizace" : "organizací"}
            </span>{" "}
            má skóre pod 40 — potenciálně inaktivní nebo ve fázi onboardingu.
          </p>
          <Link
            href="/app/platform/organizations"
            className="flex-shrink-0 text-xs text-red-600 transition-colors hover:text-red-800"
          >
            View all →
          </Link>
        </div>
      )}

      {/* Health tables */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Top organizations */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Top organizace</h2>
            <span className="text-xs text-gray-400">last 30 d · score desc · Δ = vs prev 30 d</span>
          </div>
          <HealthTableHeader />
          {overview.topOrganizations.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-gray-500">Žádné aktivní organizace.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {overview.topOrganizations.map((org, i) => (
                <HealthRow
                  key={org.organizationId}
                  org={org}
                  rank={i + 1}
                  onClick={() =>
                    router.push(`/app/platform/organizations/${org.organizationId}`)
                  }
                />
              ))}
            </div>
          )}
          <div className="border-t border-gray-200 px-4 py-2.5">
            <Link
              href="/app/platform/organizations"
              className="flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-gray-700"
            >
              Všechny organizace
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* At-risk organizations */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">At Risk</h2>
            <span className="text-xs text-gray-400">score &lt; 40</span>
          </div>
          <HealthTableHeader />
          {!hasLowHealth ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <TrendingUp className="h-6 w-6 text-emerald-500" />
              <p className="text-sm text-gray-500">Žádné organizace v pásmu At Risk.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {overview.lowHealthOrganizations.map((org) => (
                <HealthRow
                  key={org.organizationId}
                  org={org}
                  onClick={() =>
                    router.push(`/app/platform/organizations/${org.organizationId}`)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
