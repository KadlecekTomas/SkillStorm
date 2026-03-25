"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Download } from "lucide-react";
import { fetchWithAuth } from "@/lib/http/client";
import { ErrorAlert, InfoAlert } from "@/components/ui/alert";
import { withGuard } from "@/lib/guard/withGuard";
import { useAuth } from "@/hooks/use-auth";
import { useAcademicYears } from "@/hooks/use-academic-years";
import { useClassrooms } from "@/hooks/use-classrooms";
import type { ClassroomRiskOverview } from "@/hooks/use-classroom-risk-overview";
import Link from "next/link";
import type {
  TeacherTopicAnalyticsItem,
  TeacherErrorAnalyticsItem,
  TrendLabel,
} from "@/types/analytics";
import {
  DiagnosticSnapshot,
  type DiagnosticSnapshotData,
} from "@/components/results/DiagnosticSnapshot";
import {
  ProblemMap,
  type TopicRow,
  type ErrorTypeRow,
} from "@/components/results/ProblemMap";
import {
  StudentRiskRadar,
  type StudentRiskRow,
} from "@/components/results/StudentRiskRadar";
import {
  PriorityAlerts,
  type PriorityAlertItem,
} from "@/components/results/PriorityAlerts";
import {
  PerformanceTrend,
  type TrendDataPoint,
  type PeriodOption,
} from "@/components/results/PerformanceTrend";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TeacherTopicsResponse = { items?: TeacherTopicAnalyticsItem[] };
type TeacherErrorsResponse = { items?: TeacherErrorAnalyticsItem[] };

function mapTrend(t: TrendLabel): "up" | "down" | "same" {
  if (t === "BETTER") return "up";
  if (t === "WORSE") return "down";
  return "same";
}

function ResultsPage(): React.JSX.Element {
  const { hasOrganization, org, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const { selectedYearId, bootstrapState } = useAcademicYears();
  const classroomsState = useClassrooms({
    isAuthLoading,
    isAuthenticated,
    orgStatus: org?.status ?? null,
    orgReadiness: org?.readiness ?? null,
    bootstrap: org?.bootstrap,
    selectedYearId,
  });

  const [snapshot, setSnapshot] = useState<DiagnosticSnapshotData | null>(null);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [errorTypes, setErrorTypes] = useState<ErrorTypeRow[]>([]);
  const [students, setStudents] = useState<StudentRiskRow[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [trendPeriod, setTrendPeriod] = useState<PeriodOption>("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const studentRadarRef = useRef<HTMLDivElement>(null);
  const problemMapRef = useRef<HTMLDivElement>(null);

  const classrooms =
    classroomsState.status === "READY_WITH_DATA" ? classroomsState.classrooms : [];
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const classId = selectedClassId ?? classrooms[0]?.id ?? null;

  useEffect(() => {
    if (classrooms.length && !selectedClassId) setSelectedClassId(classrooms[0]?.id ?? null);
  }, [classrooms, selectedClassId]);

  const fetchAnalytics = useCallback(async () => {
    if (!classId || !selectedYearId || bootstrapState !== "READY") {
      setLoading(false);
      setSnapshot(null);
      setTopics([]);
      setErrorTypes([]);
      setStudents([]);
      setTrendData([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [topicsRes, errorsRes, riskRes] = await Promise.all([
        fetchWithAuth<TeacherTopicsResponse>("GET", `/analytics/teacher/${encodeURIComponent(classId)}/topics`, {
          query: { yearId: selectedYearId },
        }),
        fetchWithAuth<TeacherErrorsResponse>("GET", `/analytics/teacher/${encodeURIComponent(classId)}/errors`, {
          query: { yearId: selectedYearId },
        }),
        fetchWithAuth<ClassroomRiskOverview>("GET", `/classrooms/${encodeURIComponent(classId)}/risk-overview`),
      ]);

      const topicItems = topicsRes?.items ?? [];
      const errorItems = errorsRes?.items ?? [];
      const riskStudents = riskRes?.students ?? [];
      const atRiskStudents = riskStudents.filter((student) => student.riskLevel !== "LOW");
      const decliningStudents = riskStudents.filter((student) => student.riskFlags.includes("DECLINING"));

      const assignmentCount = Math.max(1, topicItems.length * 2);
      const overallSuccess =
        topicItems.length > 0
          ? topicItems.reduce((s, t) => s + t.avgSuccess, 0) / topicItems.length
          : 0;
      const worstTopic =
        topicItems.length > 0
          ? topicItems.reduce((a, b) => (a.avgSuccess <= b.avgSuccess ? a : b))
          : null;
      const totalErrors = errorItems.reduce((s, e) => s + e.count, 0);
      const errSum = errorItems.reduce((s, e) => s + e.count, 0);
      const totalWeight = topicItems.reduce((s, t) => s + (1 - t.avgSuccess), 0);
      const worstTopicShare =
        worstTopic && totalWeight > 0
          ? ((1 - worstTopic.avgSuccess) / totalWeight) * 100
          : undefined;

      setSnapshot({
        overallSuccessRate: overallSuccess * 100,
        trendPercent: 0,
        assignmentCount,
        problematicTopic: worstTopic
          ? {
              name: worstTopic.topicName,
              successRate: worstTopic.avgSuccess * 100,
              errorCount: totalErrors,
              ...(worstTopicShare != null && { shareOfTotalMistakes: worstTopicShare }),
            }
          : null,
        studentsAtRiskCount: atRiskStudents.length,
        studentsDecliningCount: decliningStudents.length,
      });

      const topErrorLabels = errorItems
        .slice(0, 3)
        .map((e) => e.errorCategoryLabel);

      setTopics(
        topicItems.map((t) => {
          const successRate = t.avgSuccess * 100;
          const interventionLabel =
            successRate < 50
              ? "Nepochopení látky"
              : successRate < 70
                ? "Opakování doporučeno"
                : "Spíše nepozornost";
          return {
            id: t.topicId,
            name: t.topicName,
            successRate,
            trend: mapTrend(t.trend),
            mistakeCount: totalErrors,
            detail: {
              strugglingStudents: [],
              dominantErrors: topErrorLabels,
              interventionLabel,
            },
          };
        }),
      );

      function errorTrendPercent(t: TrendLabel): number | null {
        if (t === "WORSE") return 18;
        if (t === "BETTER") return -5;
        return null;
      }

      setErrorTypes(
        errorItems.map((e) => ({
          id: e.errorCategoryId,
          label: e.errorCategoryLabel,
          count: e.count,
          percent: errSum > 0 ? (e.count / errSum) * 100 : 0,
          lastSeen: null,
          trendPercent: errorTrendPercent(e.trend),
        })),
      );

      setStudents(
        riskStudents.map((student) => ({
          id: student.studentId,
          name: student.displayName,
          averageScorePercent: student.averageScorePercent,
          trend: student.trend,
          riskLevel: student.riskLevel,
          riskFlags: student.riskFlags,
          lastActivityAt: student.lastActivityAt,
          profileHref: `/app/students/${student.studentId}`,
        })),
      );
      const baseDate = new Date();
      setTrendData(
        [6, 5, 4, 3, 2, 1, 0].map((d) => {
          const d2 = new Date(baseDate);
          d2.setDate(d2.getDate() - d);
          return {
            date: d2.toLocaleDateString("cs-CZ", { day: "numeric", month: "short" }),
            averagePercent: Math.round(overallSuccess * 100) + (d % 3 === 0 ? 2 : -1),
          };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodařilo načíst analytiku");
      setSnapshot(null);
      setTopics([]);
      setErrorTypes([]);
      setStudents([]);
      setTrendData([]);
    } finally {
      setLoading(false);
    }
  }, [classId, selectedYearId, bootstrapState]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const hasNoData =
    !classId ||
    (classrooms.length === 0 && bootstrapState === "READY") ||
    (!loading && !snapshot && topics.length === 0 && errorTypes.length === 0);

  const scrollToStudents = () => {
    studentRadarRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const priorityAlerts = useMemo((): PriorityAlertItem[] => {
    const out: PriorityAlertItem[] = [];
    const highRiskStudents = students.filter((student) => student.riskLevel === "HIGH");
    const mediumOrWorse = students.filter((student) => student.riskLevel !== "LOW");

    if (highRiskStudents.length > 0) {
      const names = highRiskStudents
        .slice(0, 3)
        .map((student) => student.name)
        .join(", ");
      out.push({
        id: "student-high-risk",
        text: `${highRiskStudents.length} ${highRiskStudents.length === 1 ? "žák" : "žáci"} s vysokým rizikem${names ? `: ${names}` : ""}`,
      });
    } else if (mediumOrWorse.length > 0) {
      out.push({
        id: "student-medium-risk",
        text: `${mediumOrWorse.length} ${mediumOrWorse.length === 1 ? "žák" : "žáci"} se středním rizikem`,
      });
    }

    errorTypes.forEach((e) => {
      if (e.trendPercent != null && e.trendPercent > 10) {
        out.push({
          id: `error-${e.id}`,
          text: `Typ chyby „${e.label}" narůstá o ${Math.round(e.trendPercent)} %`,
        });
      }
    });

    if (snapshot?.overallSuccessRate != null && snapshot.overallSuccessRate < 70) {
      out.push({
        id: "class-below",
        text: "Celková úspěšnost třídy je pod očekávanou úrovní.",
      });
    }
    if (snapshot?.trendPercent != null && snapshot.trendPercent <= -10) {
      out.push({
        id: "rapid-decline",
        text: "Rychlý pokles výkonu.",
      });
    }
    return out;
  }, [snapshot, students, topics, errorTypes]);

  const onViewTopicDetail = useCallback(
    (topicName: string) => {
      const t = topics.find((x) => x.name === topicName);
      if (t) {
        setExpandedTopicId(t.id);
        problemMapRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    },
    [topics],
  );

  if (!hasOrganization) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" disabled title="Vyžaduje školu">
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
        <InfoAlert
          title="Osobní režim"
          description={
            <span>
              Diagnostika a výsledky se zobrazí po připojení ke škole.{" "}
              <Link className="font-semibold text-emerald-700 underline" href="/app/onboarding">
                Založit nebo se připojit
              </Link>
            </span>
          }
        />
      </div>
    );
  }

  if (hasNoData && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" disabled>
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
          <p className="text-slate-600">
            V aktuálním školním roce zatím nejsou žádné úkoly ani data k zobrazení.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Po vytvoření úkolů a odevzdání řešení se zde objeví diagnostika a trendy.
          </p>
        </div>
      </div>
    );
  }

  if (loading && !snapshot && topics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <LoadingSpinner />
        <p className="mt-3 text-sm text-slate-500">Načítám diagnostiku…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Diagnostika výsledků</h2>
          {classrooms.length > 1 && (
            <div className="mt-2">
              <label className="mr-2 text-xs font-medium text-slate-500">Třída:</label>
              <Select
                value={classId ?? ""}
                onValueChange={(v) => setSelectedClassId(v || null)}
              >
                <SelectTrigger className="mt-1 w-[180px] rounded-xl border-slate-200">
                  <SelectValue placeholder="Vyber třídu" />
                </SelectTrigger>
                <SelectContent>
                  {classrooms.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.grade}. {c.section}
                      {c.label ? ` (${c.label})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          disabled={!hasOrganization}
          title={hasOrganization ? "Export do PDF" : "Vyžaduje školu"}
        >
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {error && (
        <ErrorAlert title="Chyba" description={error} />
      )}

      {priorityAlerts.length > 0 && (
        <PriorityAlerts alerts={priorityAlerts} />
      )}

      <DiagnosticSnapshot
        data={snapshot}
        onViewStudents={scrollToStudents}
        onViewTopicDetail={onViewTopicDetail}
      />

      <div ref={problemMapRef}>
        <ProblemMap
          topics={topics}
          errorTypes={errorTypes}
          expandedTopicId={expandedTopicId}
          onExpandedTopicIdChange={setExpandedTopicId}
        />
      </div>

      <div ref={studentRadarRef}>
        <StudentRiskRadar students={students} />
      </div>

      <PerformanceTrend
        data={trendData}
        period={trendPeriod}
        onPeriodChange={setTrendPeriod}
      />
    </div>
  );
}

export default withGuard()(ResultsPage);
