"use client";

import { useEffect, useState } from "react";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey } from "@/types";
import { fetchWithAuth } from "@/lib/http/client";
import { useAcademicYears } from "@/hooks/use-academic-years";
import type {
  StudentErrorAnalyticsItem,
  StudentTopicAnalyticsItem,
} from "@/types/analytics";
import { StudentErrorOverview } from "@/components/analytics/StudentErrorOverview";
import { StudentTopicOverview } from "@/components/analytics/StudentTopicOverview";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

type StudentErrorsResponse = { items: StudentErrorAnalyticsItem[] };
type StudentTopicsResponse = { items: StudentTopicAnalyticsItem[] };

function StudentAnalyticsPage() {
  const { selectedYearId, bootstrapState } = useAcademicYears();
  const [errors, setErrors] = useState<StudentErrorAnalyticsItem[]>([]);
  const [topics, setTopics] = useState<StudentTopicAnalyticsItem[]>([]);
  const [, setLoading] = useState(false);

  useEffect(() => {
    if (bootstrapState !== "READY" || !selectedYearId) return;
    setLoading(true);
    Promise.all([
      fetchWithAuth<StudentErrorsResponse>("GET", "/analytics/student/errors", {
        query: { yearId: selectedYearId },
      }).then((res) => res.items ?? []),
      fetchWithAuth<StudentTopicsResponse>("GET", "/analytics/student/topics", {
        query: { yearId: selectedYearId },
      }).then((res) => res.items ?? []),
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
  }, [bootstrapState, selectedYearId]);

  if (bootstrapState !== "READY" || !selectedYearId) {
    return (
      <div className="mt-6 flex justify-center">
        <LoadingSpinner />
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
  requirePerms: [PermissionKey.VIEW_RESULTS],
  requireSchoolWorkspace: true,
})(StudentAnalyticsPage);

