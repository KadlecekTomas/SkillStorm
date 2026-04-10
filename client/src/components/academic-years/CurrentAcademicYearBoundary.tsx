"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { CurrentAcademicYearRequiredScreen } from "@/components/academic-years/CurrentAcademicYearRequiredScreen";
import { fetchCurrentAcademicYear } from "@/lib/api/academic-years";
import { HttpError } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentAcademicYearState } from "@/store/use-current-academic-year-state";

type CurrentAcademicYearBoundaryProps = {
  children: ReactNode;
};

const DEPENDENT_PATH_PREFIXES = [
  "/dashboard",
  "/dashboard/tests",
  "/dashboard/assignments",
  "/tests",
  "/tests/create",
];
const EXCLUDED_PATH_PREFIXES = ["/dashboard/academic-years", "/dashboard/personal"];

type VerificationPhase = "idle" | "checking" | "ready" | "missing";

function isMissingCurrentAcademicYearError(error: unknown): boolean {
  if (!(error instanceof HttpError) || error.status !== 409) return false;
  const data = error.data as { code?: string; meta?: { code?: string } } | undefined;
  const code = data?.meta?.code ?? data?.code ?? null;
  return code === "NO_CURRENT_ACADEMIC_YEAR" || code === "NO_ACTIVE_ACADEMIC_YEAR";
}

export function CurrentAcademicYearBoundary({
  children,
}: CurrentAcademicYearBoundaryProps): React.JSX.Element {
  const pathname = usePathname() ?? "";
  const { org, orgState, context } = useAuth();
  const [phase, setPhase] = useState<VerificationPhase>("idle");
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const record = useCurrentAcademicYearState((state) =>
    org?.id ? state.byOrg[org.id] : undefined,
  );
  const markMissing = useCurrentAcademicYearState((state) => state.markMissing);
  const markAvailable = useCurrentAcademicYearState((state) => state.markAvailable);

  const requiresCurrentAcademicYear = useMemo(() => {
    if (!pathname) return false;
    if (EXCLUDED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;
    return DEPENDENT_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  }, [pathname]);

  const shouldVerifyCurrentAcademicYear =
    requiresCurrentAcademicYear &&
    !!org?.id &&
    context?.mode !== "personal" &&
    org?.type === "SCHOOL" &&
    orgState === "ACTIVE";

  const verificationKey = shouldVerifyCurrentAcademicYear && org?.id
    ? `${org.id}:${pathname}`
    : null;

  useEffect(() => {
    if (!verificationKey || !org?.id) {
      setPhase("idle");
      setResolvedKey(null);
      return;
    }

    let cancelled = false;
    setPhase("checking");
    setResolvedKey(null);

    fetchCurrentAcademicYear()
      .then(() => {
        if (cancelled) return;
        markAvailable(org.id);
        setPhase("ready");
        setResolvedKey(verificationKey);
      })
      .catch((error) => {
        if (cancelled) return;
        if (isMissingCurrentAcademicYearError(error)) {
          markMissing(org.id, { errorCode: "NO_CURRENT_ACADEMIC_YEAR", returnPath: pathname });
          setPhase("missing");
          setResolvedKey(verificationKey);
          return;
        }
        setPhase("ready");
        setResolvedKey(verificationKey);
      })

    return () => {
      cancelled = true;
    };
  }, [markAvailable, markMissing, org?.id, pathname, verificationKey]);

  useEffect(() => {
    if (!verificationKey) return;
    if (record?.status === "missing") {
      setPhase("missing");
      setResolvedKey(verificationKey);
    }
  }, [record?.status, verificationKey]);

  if (!requiresCurrentAcademicYear) {
    return <>{children}</>;
  }

  if (!shouldVerifyCurrentAcademicYear) {
    return <>{children}</>;
  }

  if (phase === "missing") {
    return <CurrentAcademicYearRequiredScreen />;
  }

  if (phase !== "ready" || resolvedKey !== verificationKey) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Kontroluji aktuální školní rok…" />
      </div>
    );
  }

  return <>{children}</>;
}
