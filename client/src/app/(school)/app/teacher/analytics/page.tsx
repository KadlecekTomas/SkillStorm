"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey, type OrganizationRole } from "@/types";
import { fetchWithAuth } from "@/lib/http/client";
import { useAcademicYears } from "@/hooks/use-academic-years";
import type {
  TeacherErrorAnalyticsItem,
  TeacherTopicAnalyticsItem,
} from "@/types/analytics";
import { TeacherTopicOverview } from "@/components/analytics/TeacherTopicOverview";
import { TeacherErrorOverview } from "@/components/analytics/TeacherErrorOverview";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type TeacherErrorsResponse = { items: TeacherErrorAnalyticsItem[] };
type TeacherTopicsResponse = { items: TeacherTopicAnalyticsItem[] };

const STAFF_ROLES: OrganizationRole[] = ["OWNER", "DIRECTOR", "TEACHER"];

function TeacherAnalyticsPage(): React.JSX.Element {
  const searchParams = useSearchParams();
  const classId = searchParams.get("classId");
  const { selectedYearId, bootstrapState } = useAcademicYears();
  const [errors, setErrors] = useState<TeacherErrorAnalyticsItem[]>([]);
  const [topics, setTopics] = useState<TeacherTopicAnalyticsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!classId || bootstrapState !== "READY" || !selectedYearId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [errorItems, topicItems] = await Promise.all([
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
      ]);
      setErrors(errorItems);
      setTopics(topicItems);
    } catch {
      setErrors([]);
      setTopics([]);
      setLoadError("Analytiku třídy se nepodařilo načíst.");
    } finally {
      setLoading(false);
    }
  }, [bootstrapState, classId, selectedYearId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!classId) {
    return (
      <div className="mt-6 rounded-3xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
        Vyberte třídu pro zobrazení analytiky.
      </div>
    );
  }

  if (bootstrapState !== "READY" || !selectedYearId || loading) {
    return (
      <div className="mt-6 flex justify-center">
        <LoadingSpinner label="Načítám analytiku třídy" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mt-6 space-y-3">
        <ErrorAlert title="Analytiku nelze načíst" description={loadError} />
        <Button variant="outline" onClick={() => void load()}>
          Zkusit znovu
        </Button>
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
  requireRoles: STAFF_ROLES,
  requirePerms: [PermissionKey.VIEW_RESULTS],
  requireSchoolWorkspace: true,
})(TeacherAnalyticsPage);
