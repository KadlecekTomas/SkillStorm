"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { fetchWithAuth } from "@/lib/http/client";
import { withGuard } from "@/lib/guard/withGuard";

type MaterialDetail = {
  id: string;
  title: string;
  description?: string | null;
  contentType: string;
  scope: string;
  educationLevel?: string | null;
  schoolGrade?: string | null;
  fileUrl?: string | null;
  richContent?: unknown;
  accessLevel?: string | null;
  isDownloadable?: boolean | null;
  subject?: { id?: string; name?: string | null } | null;
  topicLevel?: { id?: string; name?: string | null } | null;
};

function readableRichContent(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (value == null) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return null;
  }
}

function MaterialDetailPage(): React.JSX.Element {
  const { materialId } = useParams<{ materialId: string }>();
  const [material, setMaterial] = useState<MaterialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWithAuth<MaterialDetail>(
      "GET",
      `/learning-materials/${encodeURIComponent(materialId)}`,
    )
      .then((data) => {
        if (!cancelled) setMaterial(data ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMaterial(null);
          setError(
            err instanceof Error
              ? err.message
              : "Materiál se nepodařilo načíst.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  const richText = useMemo(
    () => readableRichContent(material?.richContent),
    [material?.richContent],
  );

  if (loading) {
    return <LoadingSpinner label="Načítám materiál" />;
  }

  if (error || !material) {
    return (
      <div className="space-y-4">
        <ErrorAlert title="Materiál nelze otevřít" description={error ?? "Materiál nebyl nalezen."} />
        <Button variant="outline" asChild>
          <Link href="/app/library">
            <ArrowLeft className="h-4 w-4" />
            Zpět do knihovny
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/app/library"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Zpět do knihovny
      </Link>

      <Card className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">
              {material.subject?.name ?? "Obecné"}
              {material.schoolGrade ? ` · ${material.schoolGrade}` : ""}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              {material.title}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">{material.contentType}</Badge>
            <Badge variant="neutral">
              {material.scope === "GLOBAL" ? "Globální" : "Školní"}
            </Badge>
          </div>
        </div>

        {material.description && (
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {material.description}
          </p>
        )}

        {material.fileUrl && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Přiložený materiál</p>
                  <p className="text-xs text-slate-500">
                    Otevře se v nové kartě.
                  </p>
                </div>
              </div>
              <Button asChild>
                <a
                  href={material.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Otevřít soubor
                </a>
              </Button>
            </div>
          </div>
        )}

        {richText && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Obsah materiálu</h2>
            <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-700">
              {richText}
            </pre>
          </div>
        )}

        {!material.fileUrl && !richText && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Materiál zatím neobsahuje přiložený soubor ani vložený obsah. Metadata a popis jsou dostupné výše.
          </div>
        )}
      </Card>
    </div>
  );
}

export default withGuard({ requireSchoolWorkspace: true })(MaterialDetailPage);
