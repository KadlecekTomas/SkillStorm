"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorAlert, SuccessAlert, WarningAlert } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { useAcademicYears } from "@/hooks/use-academic-years";
import { fetchWithAuth, HttpError } from "@/lib/http/client";

// --- Minimal local mirror of the backend preview/status contracts ---------

type IntegrationStatus = {
  connected: boolean;
  provider?: string;
  status: "CONNECTED" | "ERROR" | "DISABLED" | null;
  /** True when the access could not be refreshed → needs a fresh OAuth grant. */
  needsReconnect?: boolean;
  domain?: string | null;
  lastSyncAt?: string | null;
  errorMessage?: string | null;
  scopes?: string[];
  /** Server can start an OAuth/mock connect (env present or mock mode). */
  configured?: boolean;
  mockMode?: boolean;
};

type ClassMapping = {
  externalGroupId: string;
  externalGroupEmail: string;
  externalGroupName: string;
  grade: string;
  section: string;
  label: string;
  confidence: number;
  action: "CREATE" | "MAP_EXISTING" | "IGNORE";
  existingClassSectionId?: string | null;
};

type PreviewIssue = { code: string; message: string; severity: string };
type UnresolvedGroup = {
  externalGroupId: string;
  externalGroupEmail: string;
  externalGroupName: string;
  reason: string;
};

type Preview = {
  summary: {
    usersFound: number;
    groupsFound: number;
    classGroupsDetected: number;
    studentsDetected: number;
    teachersDetected: number;
    directorsDetected: number;
    unresolvedGroupsCount: number;
    conflictsCount: number;
  };
  classMappings: ClassMapping[];
  unresolvedGroups: UnresolvedGroup[];
  warnings: PreviewIssue[];
  errors: PreviewIssue[];
};

type CommitResult = {
  syncRunId: string;
  status: string;
  summary: Record<string, number>;
};

const GRADE_LABEL = (grade: string) => grade.replace("GRADE_", "") + ".";

const NOT_CONFIGURED_MESSAGE =
  "Google Workspace integrace není nakonfigurovaná. Doplňte GOOGLE_WORKSPACE_CLIENT_ID, GOOGLE_WORKSPACE_CLIENT_SECRET a GOOGLE_WORKSPACE_REDIRECT_URI.";

const REAUTH_MESSAGE =
  "Připojení k Google Workspace vypršelo nebo bylo odvoláno. Znovu prosím připojte Google Workspace.";

/** Map a safe OAuth callback error param to a user-facing message. */
function callbackErrorMessage(errorParam: string): string {
  switch (errorParam) {
    case "tenant_conflict":
      return "Připojený Google Workspace tenant neodpovídá této organizaci nebo už je připojený k jiné škole.";
    case "invalid_state":
    case "expired_state":
    case "replayed_state":
      return "Odkaz pro připojení byl neplatný nebo vypršel. Spusťte připojení znovu.";
    default:
      return "Připojení Google Workspace se nezdařilo. Zkuste to prosím znovu.";
  }
}

export default function GoogleWorkspaceOnboardingPage(): React.JSX.Element {
  const { org } = useAuth();
  const orgId = org?.id ?? null;
  const { years, activeYear } = useAcademicYears();

  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [yearId, setYearId] = useState<string>("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mappings, setMappings] = useState<ClassMapping[]>([]);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [callbackConnected, setCallbackConnected] = useState(false);
  const [callbackError, setCallbackError] = useState<string | null>(null);

  const base = useMemo(
    () =>
      orgId ? `/organizations/${orgId}/integrations/google-workspace` : null,
    [orgId],
  );

  useEffect(() => {
    if (activeYear?.id && !yearId) setYearId(activeYear.id);
  }, [activeYear?.id, yearId]);

  // Read the OAuth callback result from the URL, then strip the query so the
  // code/error never lingers in the address bar or browser history.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    if (params.get("connected") === "1") {
      setCallbackConnected(true);
    } else if (errorParam) {
      setCallbackError(callbackErrorMessage(errorParam));
    } else {
      return;
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const loadStatus = useCallback(async () => {
    if (!base) return;
    try {
      const data = await fetchWithAuth<IntegrationStatus>(
        "GET",
        `${base}/status`,
      );
      setStatus(data);
    } catch {
      setStatus({ connected: false, status: null });
    }
  }, [base]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const onConnect = useCallback(async () => {
    if (!base) return;
    setError(null);
    setConfigError(null);
    setLoading("connect");
    try {
      const data = await fetchWithAuth<{ url: string }>(
        "GET",
        `${base}/auth-url`,
      );
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError("Nepodařilo se získat odkaz pro připojení.");
    } catch (e) {
      const code =
        e instanceof HttpError &&
        e.data &&
        typeof e.data === "object" &&
        "code" in e.data
          ? (e.data as { code?: string }).code
          : undefined;
      if (code === "GOOGLE_WORKSPACE_NOT_CONFIGURED") {
        setConfigError(NOT_CONFIGURED_MESSAGE);
      } else {
        setError(e instanceof Error ? e.message : "Připojení se nezdařilo.");
      }
    } finally {
      setLoading(null);
    }
  }, [base]);

  // Maps an API error to a safe message; on a reauth-required code it shows the
  // reconnect message and refreshes status so the "Znovu připojit" CTA appears.
  const handleApiError = useCallback(
    async (e: unknown, fallback: string) => {
      const code =
        e instanceof HttpError &&
        e.data &&
        typeof e.data === "object" &&
        "code" in e.data
          ? (e.data as { code?: string }).code
          : undefined;
      if (code === "GOOGLE_WORKSPACE_REAUTH_REQUIRED") {
        setError(REAUTH_MESSAGE);
        await loadStatus();
        return;
      }
      setError(e instanceof Error ? e.message : fallback);
    },
    [loadStatus],
  );

  const onPreview = useCallback(async () => {
    if (!base) return;
    setLoading("preview");
    setError(null);
    setResult(null);
    try {
      const data = await fetchWithAuth<Preview>("POST", `${base}/preview`, {
        body: { academicYearId: yearId || undefined, dryRun: true },
      });
      setPreview(data);
      setMappings(data.classMappings);
    } catch (e) {
      await handleApiError(e, "Náhled se nezdařil.");
    } finally {
      setLoading(null);
    }
  }, [base, yearId, handleApiError]);

  const onCommit = useCallback(async () => {
    if (!base || !preview) return;
    setLoading("commit");
    setError(null);
    try {
      const data = await fetchWithAuth<CommitResult>("POST", `${base}/commit`, {
        body: {
          academicYearId: yearId || undefined,
          selectedClassMappings: mappings,
          selectedRoleMappings: [],
          ignoredExternalIds: mappings
            .filter((m) => m.action === "IGNORE")
            .map((m) => m.externalGroupId),
          options: {
            createMissingUsers: true,
            updateExistingUsers: true,
            deactivateMissingEnrollments: false,
            respectManualOverrides: true,
          },
        },
      });
      setResult(data);
      await loadStatus();
    } catch (e) {
      await handleApiError(e, "Import se nezdařil.");
    } finally {
      setLoading(null);
    }
  }, [base, preview, mappings, yearId, loadStatus, handleApiError]);

  const setAction = (id: string, action: ClassMapping["action"]) =>
    setMappings((prev) =>
      prev.map((m) => (m.externalGroupId === id ? { ...m, action } : m)),
    );

  if (!orgId) {
    return <div className="p-6">Není dostupná organizace.</div>;
  }

  const s = preview?.summary;
  const connected = Boolean(status?.connected);
  const hasYear = Boolean(yearId);
  const disabledReason = !connected
    ? "Nejprve připojte Google Workspace."
    : !hasYear
      ? "Vyberte akademický rok."
      : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Google Workspace onboarding</h1>
        <Link
          href="/app/settings"
          className="text-sm text-muted-foreground underline"
        >
          Zpět na nastavení
        </Link>
      </div>

      {callbackConnected && (
        <SuccessAlert title="Google Workspace byl úspěšně připojen." />
      )}
      {callbackError && <ErrorAlert title={callbackError} />}
      {status?.needsReconnect && (
        <WarningAlert
          title="Připojení Google Workspace vyžaduje obnovení"
          description={REAUTH_MESSAGE}
        />
      )}
      {configError && (
        <WarningAlert title="Chybí konfigurace" description={configError} />
      )}
      {error && <ErrorAlert title={error} />}

      {/* 1. Integration status */}
      <Card>
        <CardHeader>
          <CardTitle>Stav integrace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">
            Stav:{" "}
            <strong>
              {connected
                ? status?.status === "ERROR"
                  ? "Chyba"
                  : "Připojeno"
                : "Nepřipojeno"}
            </strong>
            {status?.mockMode && (
              <span className="ml-2 text-xs text-amber-700">(mock režim)</span>
            )}
          </div>

          {!connected && (
            <p className="text-sm text-muted-foreground">
              Integrace pouze <strong>čte</strong> uživatele, skupiny a členství
              z Google Workspace (read-only). Nezapisuje zpět do Googlu a nemaže
              žádná data ve SkillStormu.
            </p>
          )}
          {connected && status?.domain && (
            <div className="text-sm">Doména: {status.domain}</div>
          )}
          {connected && status?.lastSyncAt && (
            <div className="text-sm">
              Poslední sync: {new Date(status.lastSyncAt).toLocaleString()}
            </div>
          )}
          {connected && status?.scopes && status.scopes.length > 0 && (
            <div className="text-xs text-muted-foreground break-all">
              Scopes: {status.scopes.join(", ")}
            </div>
          )}
          {connected && status?.status === "ERROR" && status?.errorMessage && (
            <div className="text-sm text-red-600">{status.errorMessage}</div>
          )}

          {(!connected || status?.needsReconnect) && (
            <Button
              onClick={onConnect}
              className="mt-2"
              disabled={loading === "connect"}
            >
              {loading === "connect"
                ? "Přesměrovávám…"
                : status?.needsReconnect
                  ? "Znovu připojit Google Workspace"
                  : "Připojit Google Workspace"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 2. Year + preview */}
      <Card>
        <CardHeader>
          <CardTitle>Náhled importu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block text-sm">
            Akademický rok
            <select
              className="ml-2 border rounded px-2 py-1"
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name ?? y.id}
                </option>
              ))}
            </select>
          </label>
          <div>
            <Button
              onClick={onPreview}
              disabled={loading === "preview" || !connected || !hasYear}
            >
              {loading === "preview" ? "Načítám…" : "Načíst náhled"}
            </Button>
            {disabledReason && (
              <p className="text-xs text-muted-foreground mt-1">
                {disabledReason}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 5. Summary cards */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Uživatelé" value={s.usersFound} />
          <SummaryCard label="Skupiny" value={s.groupsFound} />
          <SummaryCard label="Třídy" value={s.classGroupsDetected} />
          <SummaryCard label="Žáci" value={s.studentsDetected} />
          <SummaryCard label="Učitelé" value={s.teachersDetected} />
          <SummaryCard label="Ředitelé" value={s.directorsDetected} />
          <SummaryCard label="Nejasné skupiny" value={s.unresolvedGroupsCount} />
          <SummaryCard label="Konflikty" value={s.conflictsCount} />
        </div>
      )}

      {/* 6. Class table */}
      {preview && preview.classMappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mapování tříd</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Google skupina</th>
                  <th>Navržená třída</th>
                  <th>Confidence</th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.externalGroupId} className="border-b">
                    <td className="py-2">{m.externalGroupEmail}</td>
                    <td>
                      {GRADE_LABEL(m.grade)}
                      {m.section}
                    </td>
                    <td>{Math.round(m.confidence * 100)}%</td>
                    <td>
                      <select
                        className="border rounded px-2 py-1"
                        value={m.action}
                        onChange={(e) =>
                          setAction(
                            m.externalGroupId,
                            e.target.value as ClassMapping["action"],
                          )
                        }
                      >
                        <option value="CREATE">Vytvořit</option>
                        <option value="MAP_EXISTING">Napárovat</option>
                        <option value="IGNORE">Ignorovat</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 7. Unresolved groups */}
      {preview && preview.unresolvedGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nejasné skupiny</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {preview.unresolvedGroups.map((g) => (
              <div key={g.externalGroupId}>
                {g.externalGroupEmail} — {g.externalGroupName} ({g.reason})
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 8. Conflicts / warnings */}
      {preview && preview.warnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Varování ({preview.warnings.length})</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {preview.warnings.map((w, i) => (
              <div key={i} className="text-amber-700">
                [{w.code}] {w.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 9. Commit */}
      {preview && (
        <div>
          <Button
            onClick={onCommit}
            disabled={loading === "commit" || !connected || !hasYear}
          >
            {loading === "commit" ? "Importuji…" : "Potvrdit import"}
          </Button>
          {disabledReason && (
            <p className="text-xs text-muted-foreground mt-1">
              {disabledReason}
            </p>
          )}
        </div>
      )}

      {/* 10. Result */}
      {result && (
        <SuccessAlert
          title={`Sync dokončen se stavem ${result.status}`}
          description={`Vytvořeno: ${result.summary.usersCreated ?? 0} uživatelů, ${
            result.summary.enrollmentsCreated ?? 0
          } zápisů. (run ${result.syncRunId})`}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
