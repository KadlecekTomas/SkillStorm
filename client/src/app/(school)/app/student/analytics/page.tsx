"use client";

import { useCallback, useEffect, useState } from "react";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey, type OrganizationRole } from "@/types";
import { fetchWithAuth } from "@/lib/http/client";
import { useAcademicYears } from "@/hooks/use-academic-years";
import type {
  StudentErrorAnalyticsItem,
  StudentTopicAnalyticsItem,
} from "@/types/analytics";
import { StudentErrorOverview } from "@/components/analytics/StudentErrorOverview";
import { StudentTopicOverview } from "@/components/analytics/StudentTopicOverview";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type StudentErrorsResponse = { items: StudentErrorAnalyticsItem[] };
type StudentTopicsResponse = { items: StudentTopicAnalyticsItem[] };

const STUDENT_ONLY: OrganizationRole[] = ["STUDENT"];

function StudentAnalyticsPage(): React.JSX.Element {
  const { selectedYearId, bootstrapState } = useAcademicYears();
  const [errors, setErrors] = useState<StudentErrorAnalyticsItem[]>([]);
  const [topics, setTopics] = useState<StudentTopicAnalyticsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (bootstrapState !== "READY" || !selectedYearId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [errorItems, topicItems] = await Promise.all([
        fetchWithAuth<StudentErrorsResponse>("GET", "/analytics/student/errors", {
          query: { yearId: selectedYearId },
        }).then((res) => res.items ?? []),
        fetchWithAuth<StudentTopicsResponse>("GET", "/analytics/student/topics", {
          query: { yearId: selectedYearId },
        }).then((res) => res.items ?? []),
      ]);
      setErrors(errorItems);
      setTopics(topicItems);
    } catch {
      setErrors([]);
      setTopics([]);
      setLoadError("Tvoje výsledky se nepodařilo načíst.");
    } finally {
      setLoading(false);
    }
  }, [bootstrapState, selectedYearId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (bootstrapState !== "READY" || !selectedYearId || loading) {
    return (
      <div className="mt-6 flex justify-center">
        <LoadingSpinner label="Načítám tvoje výsledky" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mt-6 space-y-3">
        <ErrorAlert title="Výsledky nelze načíst" description={loadError} />
        <Button variant="outline" onClick={() => void load()}>
          Zkusit znovu
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <StudentErrorOverview items={errors} />
      <StudentTopicOverview items={topics} />
    </div>
  );
}

export default withGuard({
  requireRoles: STUDENT_ONLY,
  requirePerms: [PermissionKey.VIEW_RESULTS],
  requireSchoolWorkspace: true,
})(StudentAnalyticsPage);
