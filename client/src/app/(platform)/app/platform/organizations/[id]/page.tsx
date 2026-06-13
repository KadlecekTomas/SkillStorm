"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { httpClient } from "@/lib/http/client";
import { showHttpErrorToastOnce } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Info,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HealthMetric = {
  key: string;
  label: string;
  raw: number;
  cap: number;
  normalized: number;
  weight: number;
  contribution: number;
};

type TrendMetric = {
  rawA: number;
  rawB: number;
  deltaRaw: number;
  normA: number;
  normB: number;
  deltaNorm: number;
};

type OrgTrend = {
  scorePrev30d: number;
  deltaScore: number;
  trendLabel: "UP" | "DOWN" | "FLAT";
  metrics: Record<string, TrendMetric>;
};

type PlaybookAction = {
  label: string;
  type: "LINK" | "TEXT";
  value: string;
};

type HealthRecommendation = {
  code: string;
  severity: "high" | "medium" | "low";
  message: string;
  playbook: {
    title: string;
    why: string;
    actions: PlaybookAction[];
  };
};

type OrgHealthDetail = {
  organizationId: string;
  organizationName: string;
  organizationStatus: string;
  organizationCreatedAt: string;
  score: number;
  deltaScore: number;
  trendLabel: "UP" | "DOWN" | "FLAT";
  signals: {
    totalTeachers: number;
    totalStudents: number;
    activeCreators30d: number;
    activeGraders30d: number;
    activeSubmitters30d: number;
    testsCreated30d: number;
  };
  raw: {
    totalTeachers: number;
    totalStudents: number;
    activeCreators30d: number;
    activeGraders30d: number;
    activeSubmitters30d: number;
    testsCreated30d: number;
    completionSmoothed30d: number;
    inviteConversion30d: number;
  };
  breakdown: HealthMetric[];
  trend: OrgTrend;
  recommendations: HealthRecommendation[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreBadgeCls(score: number): string {
  if (score >= 80) return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (score >= 50) return "bg-amber-50 border-amber-200 text-amber-700";
  return "bg-red-50 border-red-200 text-red-600";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Healthy";
  if (score >= 50) return "Fair";
  if (score >= 40) return "Low";
  return "At Risk";
}

function statusBadgeCls(status: string): string {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "PENDING") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-600 border-red-200";
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

function severityIcon(severity: HealthRecommendation["severity"]) {
  if (severity === "high")
    return <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />;
  if (severity === "medium")
    return <Info className="h-4 w-4 flex-shrink-0 text-amber-500" />;
  return <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-gray-400" />;
}

function severityBorder(severity: HealthRecommendation["severity"]): string {
  if (severity === "high") return "border-red-200 bg-red-50";
  if (severity === "medium") return "border-amber-200 bg-amber-50";
  return "border-gray-200 bg-white";
}

function deltaCls(delta: number): string {
  if (delta > 0) return "text-emerald-600";
  if (delta < 0) return "text-red-600";
  return "text-gray-400";
}

function deltaSign(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

// ---------------------------------------------------------------------------
// BreakdownBar
// ---------------------------------------------------------------------------

function BreakdownBar({ metric }: { metric: HealthMetric }) {
  const fillCls =
    metric.normalized >= 0.8
      ? "bg-emerald-500"
      : metric.normalized >= 0.5
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-800">{metric.label}</span>
        <span className="rounded border border-gray-200 px-2 py-0.5 font-mono text-xs text-gray-500">
          {pct(metric.weight)} weight
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${fillCls}`}
          style={{ width: `${Math.round(metric.normalized * 100)}%` }}
        />
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Raw</p>
          <p className="font-mono text-sm text-gray-800">{metric.raw}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Cap</p>
          <p className="font-mono text-sm text-gray-600">{metric.cap}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Norm.</p>
          <p className="font-mono text-sm text-gray-600">{pct(metric.normalized)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Contrib.</p>
          <p className="font-mono text-sm text-gray-600">{pct(metric.contribution)}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend table
// ---------------------------------------------------------------------------

function TrendTable({
  trend,
  breakdown,
}: {
  trend: OrgTrend;
  breakdown: HealthMetric[];
}) {
  const labelMap = Object.fromEntries(breakdown.map((m) => [m.key, m.label]));

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-400">
            <th className="px-4 py-2 text-left font-medium">Metrika</th>
            <th className="px-3 py-2 text-right font-medium">Raw (A)</th>
            <th className="px-3 py-2 text-right font-medium">Raw (B)</th>
            <th className="px-3 py-2 text-right font-medium">Δ Raw</th>
            <th className="px-3 py-2 text-right font-medium">Norm. A</th>
            <th className="px-3 py-2 text-right font-medium">Norm. B</th>
            <th className="px-3 py-2 text-right font-medium">Δ Norm.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Object.entries(trend.metrics).map(([key, m]) => (
            <tr key={key} className="text-gray-600">
              <td className="px-4 py-2.5 font-medium text-gray-700">
                {labelMap[key] ?? key}
              </td>
              <td className="px-3 py-2.5 text-right font-mono">{fmt(m.rawA)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-gray-400">{fmt(m.rawB)}</td>
              <td className={`px-3 py-2.5 text-right font-mono ${deltaCls(m.deltaRaw)}`}>
                {deltaSign(m.deltaRaw)}
              </td>
              <td className="px-3 py-2.5 text-right font-mono">{pct(m.normA)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-gray-400">{pct(m.normB)}</td>
              <td className={`px-3 py-2.5 text-right font-mono ${deltaCls(m.deltaNorm)}`}>
                {deltaSign(Math.round(m.deltaNorm * 100))}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Playbook card
// ---------------------------------------------------------------------------

function PlaybookCard({ rec }: { rec: HealthRecommendation }) {
  return (
    <div
      className={`rounded-xl border p-4 ${severityBorder(rec.severity)}`}
    >
      <div className="mb-3 flex items-start gap-2.5">
        {severityIcon(rec.severity)}
        <div className="min-w-0">
          <p className="font-semibold text-gray-800">{rec.playbook.title}</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">
            {rec.code}
          </p>
        </div>
      </div>
      <p className="mb-3 text-sm text-gray-600">{rec.playbook.why}</p>
      <div className="flex flex-wrap gap-2">
        {rec.playbook.actions.map((action, i) => {
          if (action.type === "LINK") {
            return (
              <Link
                key={i}
                href={action.value}
                className="flex items-center gap-1.5 rounded border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900"
              >
                {action.label}
                <ExternalLink className="h-3 w-3 flex-shrink-0 text-gray-400" />
              </Link>
            );
          }
          return (
            <p
              key={i}
              className="w-full rounded bg-gray-100 px-3 py-2 text-xs text-gray-600"
            >
              {action.value}
            </p>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Raw signal row
// ---------------------------------------------------------------------------

function RawRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="font-mono text-xs text-gray-700">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OrgHealthDetailPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const orgId = typeof params.id === "string" ? params.id : params.id?.[0];

  const [detail, setDetail] = useState<OrgHealthDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(false);
    try {
      const data = await httpClient.get<OrgHealthDetail>(
        `/platform/organizations/${orgId}/health`,
        { cache: "no-store" },
      );
      if (!aliveRef.current) return;
      setDetail(data);
    } catch (err) {
      if (!aliveRef.current) return;
      showHttpErrorToastOnce(err);
      setError(true);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl bg-gray-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl bg-gray-200" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-xl bg-gray-200" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <p className="text-sm text-gray-500">Detail se nepodařilo načíst.</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Zpět
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void load()}
          >
            Zkusit znovu
          </Button>
        </div>
      </div>
    );
  }

  const hasRecs = detail.recommendations.length > 0;
  const auditLink = `/app/platform/audit?organizationId=${detail.organizationId}`;

  const TrendIcon =
    detail.trendLabel === "UP"
      ? TrendingUp
      : detail.trendLabel === "DOWN"
        ? TrendingDown
        : Minus;
  const trendIconCls =
    detail.trendLabel === "UP"
      ? "text-emerald-600"
      : detail.trendLabel === "DOWN"
        ? "text-red-600"
        : "text-gray-400";

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Zpět
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="truncate text-xl font-semibold text-gray-900">
            {detail.organizationName}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeCls(detail.organizationStatus)}`}
            >
              {detail.organizationStatus}
            </span>
            <span className="text-xs text-gray-400">
              Created{" "}
              {new Date(detail.organizationCreatedAt).toLocaleDateString("cs-CZ")}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3">
          {/* Score + trend cluster */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex flex-col items-center rounded-xl border px-4 py-2 ${scoreBadgeCls(detail.score)}`}
            >
              <span className="font-mono text-3xl font-bold">{detail.score}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {scoreLabel(detail.score)}
              </span>
            </div>
            {/* Delta badge */}
            <div className="flex items-center gap-1">
              <TrendIcon className={`h-3.5 w-3.5 ${trendIconCls}`} />
              <span className={`font-mono text-xs font-semibold ${deltaCls(detail.deltaScore)}`}>
                {deltaSign(detail.deltaScore)} vs prev 30 d
              </span>
            </div>
          </div>

          <Link
            href={auditLink}
            className="flex items-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2 text-xs text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
          >
            Audit log
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Score breakdown cards */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-600">
          Score breakdown — last 30 days
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {detail.breakdown.map((m) => (
            <BreakdownBar key={m.key} metric={m} />
          ))}
        </div>
      </div>

      {/* Trend section */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-600">
            Trend — last 30 d (A) vs předchozích 30 d (B)
          </h2>
          <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500">
            prev score: {detail.trend.scorePrev30d}
          </span>
        </div>
        <TrendTable trend={detail.trend} breakdown={detail.breakdown} />
      </div>

      {/* Recommendations + playbook */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-600">
          Recommendations &amp; Action playbook
        </h2>
        {!hasRecs ? (
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <p className="text-sm text-gray-500">
              No issues detected. Organization looks healthy.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {detail.recommendations.map((rec) => (
              <PlaybookCard key={rec.code} rec={rec} />
            ))}
          </div>
        )}
      </div>

      {/* Raw signals */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-600">
            Activity signals (last 30 d)
          </h2>
          <RawRow label="Aktivní učitelé (tvoří testy)" value={detail.raw.activeCreators30d} />
          <RawRow label="Aktivní učitelé (zadávají práci)" value={detail.raw.activeGraders30d} />
          <RawRow label="Aktivní žáci (odevzdávají)" value={detail.raw.activeSubmitters30d} />
          <RawRow label="Testy vytvořené" value={detail.raw.testsCreated30d} />
          <RawRow label="Completion (smoothed)" value={pct(detail.raw.completionSmoothed30d)} />
          <RawRow label="Invite conversion" value={pct(detail.raw.inviteConversion30d)} />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-600">
            Organization size
          </h2>
          <RawRow label="Celkem učitelů" value={detail.raw.totalTeachers} />
          <RawRow label="Celkem žáků" value={detail.raw.totalStudents} />
        </div>
      </div>
    </div>
  );
}
