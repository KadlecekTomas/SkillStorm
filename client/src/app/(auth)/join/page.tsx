"use client";

import { type JSX, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Building2, GraduationCap, CalendarDays, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchWithAuth, httpClient, HttpError } from "@/lib/http/client";
import { useAuth } from "@/hooks/use-auth";
import { useAcademicYearStore } from "@/store/use-academic-year-store";
import { showToastOnce, resolveToastFromHttpError } from "@/utils/toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { setAuthIntent, clearAuthIntent } from "@/lib/auth-intent";

type InvitePreview = {
  type: "ORG_ONLY" | "STUDENT_CLASS";
  organizationId: string;
  organizationName: string;
  role?: string;
  classSectionId?: string;
  yearId?: string;
  classLabel?: string;
  yearLabel?: string;
};

/** Fetch preview via token-based API (production). */
async function fetchPreviewByToken(token: string): Promise<InvitePreview> {
  const res = await httpClient.get<InvitePreview>(
    `/invitations/preview?token=${encodeURIComponent(token)}`,
  );
  return res;
}

/** Accept invite via token-based API (production). */
async function acceptByToken(
  token: string,
): Promise<{ organization?: { id: string } }> {
  return fetchWithAuth("POST", "/invitations/accept", {
    body: { token },
  }) as Promise<{ organization?: { id: string }; role?: string }>;
}

export default function JoinPage(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, hasOrganization, isLoading: authLoading, syncProfile } = useAuth();
  const clearOrg = useAcademicYearStore((s) => s.clearOrg);

  const tokenFromUrl = (searchParams.get("token") ?? searchParams.get("code") ?? "").trim();
  const [joinCode, setJoinCode] = useState(tokenFromUrl);
  const [joinStep, setJoinStep] = useState<"code" | "preview" | "confirm">("code");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFetched, setPreviewFetched] = useState(false);
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const [joinErrorMessage, setJoinErrorMessage] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    if (tokenFromUrl) {
      setJoinCode(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  // Persist join intent so login/register and PostAuthResolver can return here (survives 401 and register flow)
  useEffect(() => {
    const token = searchParams.get("token")?.trim();
    const code = searchParams.get("code")?.trim();
    if (token || code) {
      setAuthIntent({
        type: "JOIN",
        ...(token ? { token } : {}),
        ...(code ? { code } : {}),
      });
    }
  }, [searchParams]);

  // Not authenticated → send to login. Intent is in sessionStorage; no redirect param required.
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Multi-org: only redirect to app when user has org AND no token in URL (no join intent)
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (hasOrganization && !tokenFromUrl) {
      router.replace("/app");
    }
  }, [authLoading, isAuthenticated, hasOrganization, tokenFromUrl, router]);

  const loadPreview = useCallback(
    async (token: string) => {
      if (!token.trim()) return;
      setPreviewLoading(true);
      setTokenError(null);
      setJoinErrorMessage(null);
      setPreview(null);
      try {
        const data = await fetchPreviewByToken(token.trim());
        setPreview(data);
        setJoinStep("preview");
      } catch (err) {
        const message =
          err instanceof HttpError
            ? resolveToastFromHttpError(err).message ?? "Pozvánka je neplatná nebo vypršela."
            : err instanceof Error && err.message.trim().length > 0
              ? err.message
              : "Pozvánka je neplatná nebo vypršela.";
        setTokenError(message);
      } finally {
        setPreviewLoading(false);
        setPreviewFetched(true);
      }
    },
    [],
  );

  // When authenticated and token in URL, auto-load preview (no race: single effect)
  useEffect(() => {
    if (!isAuthenticated || authLoading || !tokenFromUrl || previewFetched || preview) return;
    void loadPreview(tokenFromUrl);
  }, [isAuthenticated, authLoading, tokenFromUrl, previewFetched, preview, loadPreview]);

  const handlePreviewInvite = async () => {
    const trimmed = joinCode.trim();
    if (!trimmed) {
      setJoinErrorMessage("Zadej prosím kód nebo token pozvánky.");
      return;
    }
    setPreviewFetched(false);
    setTokenError(null);
    await loadPreview(trimmed);
  };

  const handleAcceptInvite = async () => {
    const trimmed = joinCode.trim();
    if (!trimmed || !preview) return;
    setJoinSubmitting(true);
    setJoinErrorMessage(null);
    try {
      const result = await acceptByToken(trimmed);
      const orgId =
        (result as { organization?: { id: string } })?.organization?.id ??
        preview.organizationId;
      clearOrg(orgId);
      await syncProfile({ force: true });
      clearAuthIntent();
      showToastOnce("Připojení proběhlo úspěšně.", { type: "success" });
      router.replace("/app");
    } catch (err) {
      if (err instanceof HttpError) {
        const resolved = resolveToastFromHttpError(err);
        setJoinErrorMessage(
          resolved.message ??
            "Připojení se nezdařilo. Zkus to prosím znovu nebo požádej ředitele o nový odkaz.",
        );
      } else if (err instanceof Error && err.message.trim().length > 0) {
        setJoinErrorMessage(err.message);
      } else {
        setJoinErrorMessage("Připojení se nezdařilo. Zkus to prosím znovu.");
      }
    } finally {
      setJoinSubmitting(false);
    }
  };

  const handleJoinBack = () => {
    setJoinStep("code");
    setPreview(null);
    setJoinErrorMessage(null);
    setTokenError(null);
    setPreviewFetched(false);
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Načítám…" />
      </div>
    );
  }

  if (hasOrganization && !tokenFromUrl) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Přesměrovávám do aplikace…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
          Připojení k organizaci
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Připoj se ke škole
        </h1>
        <p className="text-sm text-slate-500">
          Použij odkaz nebo kód pozvánky od ředitele nebo učitele. Po ověření se připojíš k organizaci a budeš přesměrován do aplikace.
        </p>
      </div>

      {tokenError && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">Neplatná nebo vypršená pozvánka</p>
              <p className="mt-1 text-sm text-amber-700">{tokenError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={handleJoinBack}
              >
                Zkusit jiný kód
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="border-slate-200 p-6">
        {joinStep === "code" && !tokenError && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="join-code">
                Kód nebo token pozvánky
              </label>
              <Input
                id="join-code"
                value={joinCode}
                onChange={(e) => {
                  // Normalize short codes: uppercase, strip spaces
                  const raw = e.target.value;
                  const normalized =
                    raw.length <= 10 ? raw.toUpperCase().replace(/\s/g, "") : raw;
                  setJoinCode(normalized);
                  setTokenError(null);
                }}
                placeholder="Kód (např. XK7M2P) nebo odkaz z pozvánky"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                disabled={previewLoading}
              />
              <p className="text-xs text-slate-500">
                Your role will be assigned automatically based on the invitation.
              </p>
            </div>
            {joinErrorMessage && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                {joinErrorMessage}
              </div>
            )}
            <Button
              onClick={() => void handlePreviewInvite()}
              disabled={previewLoading || !joinCode.trim()}
              className="w-full"
            >
              {previewLoading ? "Kontroluji…" : "Zkontrolovat a pokračovat"}
            </Button>
          </div>
        )}

        {joinStep === "preview" && preview && !tokenError && (
          <div className="space-y-4">
            {/* Organization */}
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Building2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-500" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Škola / organizace
                </p>
                <p className="mt-0.5 font-semibold text-slate-900">{preview.organizationName}</p>
              </div>
            </div>

            {/* Class + year (STUDENT_CLASS only) */}
            {preview.type === "STUDENT_CLASS" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <GraduationCap className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Třída</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">
                      {preview.classLabel ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Školní rok</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">
                      {preview.yearLabel ?? "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Role badge */}
            {preview.role && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <UserCheck className="h-4 w-4 text-slate-400" />
                <span>
                  Budeš přidán jako{" "}
                  <span className="font-medium text-slate-800 capitalize">
                    {preview.role.toLowerCase()}
                  </span>
                </span>
              </div>
            )}

            {joinErrorMessage && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
                {joinErrorMessage}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleJoinBack} disabled={joinSubmitting}>
                Zpět
              </Button>
              <Button onClick={() => void handleAcceptInvite()} disabled={joinSubmitting}>
                {joinSubmitting ? "Připojuji…" : "Připojit se"}
              </Button>
            </div>
          </div>
        )}

        {previewLoading && joinStep === "code" && !tokenError && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner label="Kontroluji pozvánku…" />
          </div>
        )}
      </Card>

      <p className="text-center text-sm text-slate-500">
        Nemáš kód?{" "}
        <Link href="/login" className="font-medium text-slate-700 underline hover:text-slate-900">
          Přihlásit se
        </Link>{" "}
        nebo{" "}
        <Link href="/register" className="font-medium text-slate-700 underline hover:text-slate-900">
          založit účet
        </Link>
        .
      </p>
    </div>
  );
}
