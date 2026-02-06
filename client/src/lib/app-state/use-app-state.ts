"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { fetchCurrentAcademicYear } from "@/lib/api/academic-years";
import { HttpError } from "@/lib/http/client";
import type { AppState } from "./app-state";

/** Timeout for GET /academic-years/current. Prevents infinite BOOTSTRAPPING. */
const CURRENT_YEAR_FETCH_TIMEOUT_MS = 15_000;

/**
 * Deliberate state machine: domain invariant enforcement (system-level consistency).
 * Frontend is NOT responsible for domain validity; it only reflects backend state.
 * BOOTSTRAPPING is a transient state only; it must transition to READY, ORG_*, or ERROR.
 */
export function useAppState(): {
  state: AppState;
  refresh: () => Promise<void>;
} {
  const { user, org, orgState, hasOrganization, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<AppState>({ code: "BOOTSTRAPPING" });
  const resolveInFlightRef = useRef(false);

  const resolveState = useCallback(async () => {
    if (authLoading || !user) {
      setState({ code: "BOOTSTRAPPING" });
      return;
    }
    if (!hasOrganization || !org) {
      setState({ code: "BOOTSTRAPPING" });
      return;
    }

    if (orgState === "PENDING") {
      setState({ code: "ORG_PENDING" });
      return;
    }
    if (orgState === "SUSPENDED") {
      setState({ code: "ORG_SUSPENDED" });
      return;
    }

    if (orgState !== "ACTIVE" && orgState !== "HAS_ORG") {
      setState({ code: "BOOTSTRAPPING" });
      return;
    }

    if (resolveInFlightRef.current) return;
    resolveInFlightRef.current = true;

    try {
      const current = await withTimeout(
        fetchCurrentAcademicYear(),
        CURRENT_YEAR_FETCH_TIMEOUT_MS,
        "ACTIVE_YEAR_FETCH_TIMEOUT",
      );
      resolveInFlightRef.current = false;
      setState({
        code: "READY",
        currentYearName: current?.name ?? null,
      });
    } catch (err) {
      resolveInFlightRef.current = false;
      const data = err instanceof HttpError ? (err.data as { code?: string; meta?: { code?: string } } | undefined) : undefined;
      const code = data?.meta?.code ?? data?.code ?? (err as { code?: string })?.code ?? null;

      if (err instanceof HttpError && err.status === 409) {
        setState({
          code: "ORG_NOT_READY",
          errorCode: code ?? "NO_ACTIVE_ACADEMIC_YEAR",
        });
        return;
      }
      if (err instanceof HttpError && (err.status === 403 || err.status === 412) && (code === "ORG_PENDING" || code === "ORG_NOT_READY")) {
        setState({ code: "ORG_PENDING" });
        return;
      }
      setState({
        code: "ERROR",
        errorCode: code ?? "ACTIVE_YEAR_FETCH_FAILED",
      });
    }
  }, [user, org, orgState, hasOrganization, authLoading]);

  useEffect(() => {
    void resolveState();
  }, [resolveState]);

  const refresh = useCallback(async () => {
    setState({ code: "BOOTSTRAPPING" });
    await resolveState();
  }, [resolveState]);

  return { state, refresh };
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutCode: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error("Request timeout"), { code: timeoutCode }));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
