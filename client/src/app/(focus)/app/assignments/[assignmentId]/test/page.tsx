"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ANSWERING_MODE_QUERY_PARAM,
  resolveAnsweringMode,
} from "@/config/answering-mode";
import { fetchWithAuth, HttpError } from "@/lib/http/client";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { withGuard } from "@/lib/guard/withGuard";
import type { OrganizationRole } from "@/types";
import type { FocusTestSession } from "@/lib/focus-test/types";
import { FocusTestRunner } from "@/components/focus-test/focus-test-runner";
import { FocusTestSkeleton } from "@/components/student-answering/focus-test-skeleton";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; session: FocusTestSession };

function resolveLoadError(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.status === 403)
      return "Tento test ti nebyl přiřazen, nebo na něj nemáš přístup.";
    if (err.status === 404) return "Zadání nebylo nalezeno.";
    if (err.status === 400)
      return (
        err.message ||
        "Test nelze právě teď otevřít (mimo okno nebo vyčerpané pokusy)."
      );
    if (err.status === 409)
      return err.message || "Organizace nebo školní rok nejsou připravené.";
  }
  return "Nepodařilo se spustit test. Zkus to prosím znovu.";
}

function FocusTestPage(): JSX.Element {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params.assignmentId;
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  // Demo/override query param (?mode=young|old). Presentation-only — never
  // included in any backend request. Read from window to avoid a Suspense
  // boundary requirement of useSearchParams.
  const modeOverride = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get(
      ANSWERING_MODE_QUERY_PARAM,
    );
  }, []);

  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    setState({ kind: "loading" });
    (async () => {
      try {
        const session = await fetchWithAuth<FocusTestSession>(
          "GET",
          `/assignments/${assignmentId}/test-session`,
        );
        if (!active) return;
        if (session.submission.submittedAt) {
          router.replace(`/app/results/${session.submission.id}`);
          return;
        }
        setState({ kind: "ready", session });
      } catch (err) {
        if (!active) return;
        setState({ kind: "error", message: resolveLoadError(err) });
      }
    })();
    return () => {
      active = false;
    };
  }, [assignmentId, router]);

  const onSubmitted = useCallback(
    (submissionId: string) => {
      router.replace(`/app/results/${submissionId}`);
    },
    [router],
  );
  const onLeave = useCallback(() => {
    router.push("/app/assignments");
  }, [router]);

  if (state.kind === "loading") {
    return <FocusTestSkeleton />;
  }

  if (state.kind === "error") {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8">
        <ErrorAlert title="Test nelze spustit" description={state.message} />
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/app/assignments")}
        >
          Zpět na zadání
        </Button>
      </div>
    );
  }

  return (
    <FocusTestRunner
      session={state.session}
      mode={resolveAnsweringMode(state.session.student?.grade ?? null, modeOverride)}
      onSubmitted={onSubmitted}
      onLeave={onLeave}
    />
  );
}

const studentOnly: OrganizationRole[] = ["STUDENT"];

export default withGuard({
  requireRoles: studentOnly,
  requireSchoolWorkspace: true,
})(FocusTestPage);
