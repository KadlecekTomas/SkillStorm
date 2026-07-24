"use client";

import { useCallback, useEffect, useState } from "react";
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
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type StudentErrorsResponse = { items: StudentErrorAnalyticsItem[] };
type StudentTopicsResponse = { items: StudentTopicAnalyticsItem[] };

type LoadState = "loading" | "ready" | "error";

function StudentAnalyticsPage() {
  const { selectedYearId, bootstrapState } = useAcademicYears();
  const [errors, setErrors] = useState<StudentErrorAnalyticsItem[]>([]);
  const [topics, setTopics] = useState<StudentTopicAnalyticsItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(async () => {
    if (bootstrapState !== "READY" || !selectedYearId) return;
    setState("loading");
    try {
      const [errorsRes, topicsRes] = await Promise.all([
        fetchWithAuth<StudentErrorsResponse>("GET", "/analytics/student/errors", {
          query: { yearId: selectedYearId },
        }),
        fetchWithAuth<StudentTopicsResponse>("GET", "/analytics/student/topics", {
          query: { yearId: selectedYearId },
        }),
      ]);
      setErrors(errorsRes.items ?? []);
      setTopics(topicsRes.items ?? []);
      setState("ready");
    } catch {
      // Chyba serveru se NESMÍ tvářit jako prázdná data — rozlišíme error stav.
      setErrors([]);
      setTopics([]);
      setState("error");
    }
  }, [bootstrapState, selectedYearId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isBootstrapping = bootstrapState !== "READY" || !selectedYearId;

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Moje výsledky</h1>
        <p className="text-sm text-ink-muted">
          Přehled tvých nejčastějších chyb a témat, na kterých můžeš zapracovat.
        </p>
      </div>

      {isBootstrapping || state === "loading" ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Načítám tvoje výsledky…" />
        </div>
      ) : state === "error" ? (
        <div className="space-y-3">
          <ErrorAlert
            title="Výsledky se nepodařilo načíst"
            description="Zkontroluj připojení a zkus to prosím znovu."
          />
          <Button variant="outline" onClick={() => void load()}>
            Zkusit znovu
          </Button>
        </div>
      ) : (
        <>
          <StudentErrorOverview items={errors} />
          <StudentTopicOverview items={topics} />
        </>
      )}
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.VIEW_RESULTS],
  requireSchoolWorkspace: true,
})(StudentAnalyticsPage);
