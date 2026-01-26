"use client";

import { useEffect, useState } from "react";
import { httpClient, HttpError, ForbiddenError } from "@/lib/http/client";
import { TestDetail, type TestQuestion } from "@/components/tests/test-detail";
import { AccessDenied } from "@/components/access/access-denied";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { audit } from "@/lib/audit/audit.client";
import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey } from "@/types";
import { useParams } from "next/navigation";

type PolicyTestResponse = {
  test: {
    id: string;
    title: string;
    description: string;
    orgId: string;
    questions: TestQuestion[];
  };
};

function OrgTestPage() {
  const params = useParams<{ orgId: string; testId: string }>();
  const [test, setTest] = useState<PolicyTestResponse["test"] | null>(null);
  const [state, setState] = useState<"loading" | "forbidden" | "not_found" | "ready">("loading");

  useEffect(() => {
    const testId = params?.testId;
    if (!testId) return;
    let active = true;
    setState("loading");
    httpClient
      .get<PolicyTestResponse>(`/tests/${testId}`)
      .then((data) => {
        if (!active) return;
        setTest(data.test);
        setState("ready");
        audit({ action: "TEST_OPEN", entityId: data.test.id, meta: { orgId: data.test.orgId } });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ForbiddenError) {
          setState("forbidden");
          return;
        }
        if (error instanceof HttpError && error.status === 404) {
          setState("not_found");
          return;
        }
        setState("not_found");
      });
    return () => {
      active = false;
    };
  }, [params?.testId]);

  if (state === "loading") {
    return <LoadingSpinner label="Načítám test" />;
  }

  if (state === "forbidden") {
    return (
      <AccessDenied description="Tento test není dostupný pro tvoji organizaci." />
    );
  }

  if (state === "not_found" || !test) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-6 text-sm text-slate-600">
        Test nebyl nalezen.
      </div>
    );
  }

  return (
    <TestDetail
      title={test.title}
      description={test.description}
      questions={test.questions}
      showSubmit={false}
    />
  );
}

export default withGuard({
  requirePerms: [PermissionKey.VIEW_RESULTS],
  requireSchoolWorkspace: true,
})(OrgTestPage);
