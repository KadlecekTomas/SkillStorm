"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey } from "@/types";
import { fetchWithAuth } from "@/lib/http/client";
import { useAcademicYears } from "@/hooks/use-academic-years";
import type {
  TeacherErrorAnalyticsItem,
  TeacherTopicAnalyticsItem,
} from "@/types/analytics";
import { TeacherTopicOverview } from "@/components/analytics/TeacherTopicOverview";
import { TeacherErrorOverview } from "@/components/analytics/TeacherErrorOverview";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

type TeacherErrorsResponse = { items: TeacherErrorAnalyticsItem[] };
type TeacherTopicsResponse = { items: TeacherTopicAnalyticsItem[] };

function TeacherAnalyticsPage() {
  const searchParams = useSearchParams();
  const classId = searchParams.get("classId");
  const { selectedYearId, bootstrapState } = useAcademicYears();
  const [errors, setErrors] = useState<TeacherErrorAnalyticsItem[]>([]);
  const [topics, setTopics] = useState<TeacherTopicAnalyticsItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!classId || bootstrapState !== "READY" || !selectedYearId) return;
    setLoading(true);
    Promise.all([
      fetchWithAuth<TeacherErrorsResponse>(
        "GET",
        `/analytics/teacher/${encodeURIComponent(classId)}/errors`,
        { query: { yearId: selectedYearId } },
      ).then((res) => res.items ?? []),
      fetchWithAuth<TeacherTopicsResponse>(
        "GET",
        `/analytics/teacher/${encodeURIComponent(classId)}/topics`,
        { query: { yearId: selectedYearId } },
      ).then((res) => res.items ?? []),
    ])
      .then(([errorItems, topicItems]) => {
        setErrors(errorItems);
        setTopics(topicItems);
      })
      .catch(() => {
        setErrors([]);
        setTopics([]);
      })
      .finally(() => setLoading(false));
  }, [bootstrapState, classId, selectedYearId]);

  if (!classId) {
    return (
      <div className="mt-6 rounded-3xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
        Vyber třídu (parametr <code>classId</code>) pro zobrazení analytiky.
      </div>
    );
  }

  if (bootstrapState !== "READY" || !selectedYearId || loading) {
    return (
      <div className="mt-6 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <TeacherTopicOverview items={topics} />
      <TeacherErrorOverview items={errors} />
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.VIEW_RESULTS],
  requireSchoolWorkspace: true,
})(TeacherAnalyticsPage);

