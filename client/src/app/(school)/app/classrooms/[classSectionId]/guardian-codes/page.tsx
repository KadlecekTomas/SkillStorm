"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  createGuardianCodesForClass,
  type GuardianBulkResult,
} from "@/hooks/use-guardian";

/**
 * Arch párovacích kódů pro rodiče (guardian Etapa B — primární flow).
 * Mřížka lístečků na A4, rozstříhatelná; tisk přímo z prohlížeče přes
 * print CSS (visibility trik — tiskne se JEN arch, žádné chrome aplikace).
 * Kódy jsou jednorázové s platností 30 dní; nový arch = nové kódy, staré
 * zůstávají platné do vyčerpání/expirace.
 */

const expiryFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

function Slip({
  studentName,
  code,
  expiresAt,
}: {
  studentName: string;
  code: string;
  expiresAt: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-line-strong p-4 print:break-inside-avoid print:rounded-none print:border-slate-400">
      <p className="text-[15px] font-extrabold text-ink print:text-black">
        {studentName}
      </p>
      <p className="rounded-lg bg-canvas-alt px-3 py-2 text-center font-mono text-2xl font-bold tracking-[.3em] text-ink print:bg-transparent print:text-black">
        {code}
      </p>
      <ol className="list-decimal space-y-0.5 pl-4 text-xs leading-relaxed text-ink-muted print:text-slate-700">
        <li>Na telefonu či počítači otevřete stránku školy: skillstorm.app/join</li>
        <li>Zadejte kód z tohoto lístečku a zaregistrujte se.</li>
        <li>Potvrďte, že jde o vaše dítě — a máte hotovo.</li>
      </ol>
      <p className="text-[11px] text-ink-dim print:text-slate-500">
        Kód platí do {expiryFormatter.format(new Date(expiresAt))} a lze použít
        jen jednou.
      </p>
    </div>
  );
}

export default function GuardianCodesPage() {
  const router = useRouter();
  const params = useParams<{ classSectionId: string }>();
  const classSectionId = params?.classSectionId ?? null;

  const [result, setResult] = useState<GuardianBulkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!classSectionId) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await createGuardianCodesForClass(classSectionId));
    } catch {
      setError(
        "Kódy se nepodařilo vygenerovat. Zkuste to prosím znovu — kdyby to nešlo, kód pro jednotlivého žáka vystavíte v detailu třídy.",
      );
    } finally {
      setLoading(false);
    }
  }, [classSectionId]);

  return (
    <div className="space-y-5">
      {/* Ovládání — při tisku skryté */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Zpět">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-extrabold text-ink">
              Kódy pro rodiče{result ? ` · ${result.classLabel}` : ""}
            </h1>
            <p className="text-sm text-ink-muted">
              Každý žák dostane lísteček s kódem. Rodič se s ním propojí se svým
              dítětem — kód je jednorázový a platí 30 dní.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!result ? (
            <Button size="lg" onClick={() => void generate()} disabled={loading || !classSectionId}>
              {loading ? "Generuji…" : "Vygenerovat kódy pro třídu"}
            </Button>
          ) : (
            <Button size="lg" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Vytisknout arch
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-danger bg-danger/5 px-4 py-3 text-sm text-danger print:hidden">
          {error}
        </p>
      )}

      {loading && (
        <div className="flex justify-center py-16 print:hidden">
          <LoadingSpinner />
        </div>
      )}

      {result && (
        <>
          <p className="flex items-center gap-1.5 text-xs text-ink-dim print:hidden">
            <Scissors className="h-3.5 w-3.5" /> Arch je připravený k tisku a
            rozstříhání — {result.slips.length}{" "}
            {result.slips.length === 1
              ? "lísteček"
              : result.slips.length < 5
                ? "lístečky"
                : "lístečků"}
            .
          </p>
          <div className="print-area grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-4">
            {result.slips.map((slip) => (
              <Slip
                key={slip.studentId}
                studentName={slip.studentName}
                code={slip.code ?? slip.token}
                expiresAt={slip.expiresAt}
              />
            ))}
          </div>
        </>
      )}

      {/* Tisk: viditelný jen arch, přes celé A4 */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area,
          .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            inset: 0;
            margin: 0;
            padding: 12mm;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
