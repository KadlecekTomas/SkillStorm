'use client';

import { useMemo, useState, type JSX } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Eraser,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  allowedResolutionStrategies,
  evaluateCategoryClaim,
  inspectDataSet,
  resolveDataSet,
  summarizeCategory,
  type DataIssue,
  type DataIssueType,
  type DataResolution,
  type DataResolutionStrategy,
  type DataRow,
  type DataTableSchema,
} from '@/lib/it-lab/data-quality-engine';

type DiagnosisChoice = DataIssueType | 'CLEAN';
type TransferChoice = 'BOTH' | 'MOST_ONLY' | 'NEITHER';

const schema: DataTableSchema = {
  identityKey: 'studentCode',
  columns: [
    { key: 'studentCode', label: 'Kód', type: 'TEXT', required: true },
    {
      key: 'transport',
      label: 'Doprava',
      type: 'CATEGORY',
      required: true,
      allowedValues: ['WALK', 'BUS', 'BIKE', 'CAR'],
    },
    { key: 'minutes', label: 'Minuty', type: 'NUMBER', required: true },
  ],
};

const rows: DataRow[] = [
  { id: 'r1', values: { studentCode: 'A15', transport: 'WALK', minutes: 10 } },
  { id: 'r2', values: { studentCode: 'B07', transport: 'WALK', minutes: 12 } },
  { id: 'r3', values: { studentCode: 'C21', transport: 'BUS', minutes: 25 } },
  { id: 'r4', values: { studentCode: 'D04', transport: 'BIKE', minutes: 18 } },
  { id: 'r5', values: { studentCode: 'B07', transport: 'WALK', minutes: 12 } },
  { id: 'r6', values: { studentCode: 'E11', transport: null, minutes: 20 } },
  { id: 'r7', values: { studentCode: 'F12', transport: 'TELEPORT', minutes: 30 } },
];

const transferRows: DataRow[] = [
  { id: 't1', values: { studentCode: 'H01', transport: 'BUS', minutes: 15 } },
  { id: 't2', values: { studentCode: 'H02', transport: 'BUS', minutes: 20 } },
  { id: 't3', values: { studentCode: 'H03', transport: 'WALK', minutes: 8 } },
  { id: 't4', values: { studentCode: 'H04', transport: 'BIKE', minutes: 12 } },
];

const diagnosisChoices: Array<{ type: DiagnosisChoice; label: string }> = [
  { type: 'EXACT_DUPLICATE', label: 'Duplicitní záznam' },
  { type: 'MISSING_REQUIRED', label: 'Chybějící povinný údaj' },
  { type: 'INVALID_CATEGORY', label: 'Hodnota mimo pravidla' },
  { type: 'CLEAN', label: 'Řádek je v pořádku' },
];

const transportLabel: Record<string, string> = {
  WALK: 'Pěšky',
  BUS: 'Autobus',
  BIKE: 'Kolo',
  CAR: 'Auto',
  TELEPORT: 'Teleport',
};

const issueLabel: Record<DataIssueType, string> = {
  EXACT_DUPLICATE: 'Duplicita identity',
  MISSING_REQUIRED: 'Chybějící údaj',
  INVALID_CATEGORY: 'Neplatná kategorie',
  CONFLICTING_IDENTITY: 'Konflikt záznamů',
};

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)} %`;
}

function issueExplanation(issue: DataIssue): string {
  if (issue.type === 'EXACT_DUPLICATE') {
    return `Stejný kód se objevil ve dvou totožných řádcích (${issue.rowIds.join(' + ')}).`;
  }
  if (issue.type === 'MISSING_REQUIRED') {
    return 'Povinná hodnota dopravy chybí. Nevíme, co respondent skutečně uvedl.';
  }
  if (issue.type === 'INVALID_CATEGORY') {
    return `Hodnota „${String(issue.value)}“ není mezi povolenými kategoriemi dotazníku.`;
  }
  return 'Stejná identita má rozdílné údaje. Záznamy vyžadují ověření u zdroje.';
}

function safeResolutionLabel(issue: DataIssue): string {
  if (issue.type === 'EXACT_DUPLICATE') return 'Odebrat opakovaný řádek';
  if (issue.type === 'CONFLICTING_IDENTITY') return 'Označit k ověření u zdroje';
  return 'Nevymýšlet hodnotu → vyřadit ji z této analýzy';
}

function unsafeResolutionLabel(issue: DataIssue): string {
  if (issue.type === 'EXACT_DUPLICATE') return 'Nechat oba řádky, ať máme více dat';
  if (issue.type === 'MISSING_REQUIRED') return 'Dopsat odhadem „Pěšky“';
  if (issue.type === 'INVALID_CATEGORY') return 'Přepsat hodnotu odhadem na „Autobus“';
  return 'Smazat jeden záznam bez ověření';
}

export default function DataDetectivePage(): JSX.Element {
  const issues = useMemo(() => inspectDataSet(schema, rows), []);
  const rawSummary = useMemo(() => summarizeCategory(schema, rows, 'transport'), []);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [discoveredIssueIds, setDiscoveredIssueIds] = useState<string[]>([]);
  const [diagnosisFeedback, setDiagnosisFeedback] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<DataResolution[]>([]);
  const [resolutionFeedback, setResolutionFeedback] = useState<string | null>(null);
  const [claimAnswer, setClaimAnswer] = useState<'YES' | 'NO' | null>(null);
  const [transferAnswer, setTransferAnswer] = useState<TransferChoice | null>(null);

  const allIssuesDetected = discoveredIssueIds.length === issues.length;
  const resolvedData = useMemo(
    () => resolveDataSet(schema, rows, resolutions),
    [resolutions],
  );
  const allIssuesResolved = resolvedData.unresolvedIssueIds.length === 0 && issues.length > 0;
  const cleanedClaim = useMemo(
    () => evaluateCategoryClaim(schema, resolvedData, {
      field: 'transport',
      value: 'WALK',
      kind: 'MAJORITY',
    }),
    [resolvedData],
  );
  const claimCorrect = claimAnswer === 'NO' && cleanedClaim.supported === false;

  const transferData = useMemo(() => resolveDataSet(schema, transferRows, []), []);
  const transferMajority = useMemo(
    () => evaluateCategoryClaim(schema, transferData, {
      field: 'transport',
      value: 'BUS',
      kind: 'MAJORITY',
    }),
    [transferData],
  );
  const transferMostCommon = useMemo(
    () => evaluateCategoryClaim(schema, transferData, {
      field: 'transport',
      value: 'BUS',
      kind: 'MOST_COMMON',
    }),
    [transferData],
  );
  const transferCorrect = transferAnswer === 'MOST_ONLY'
    && transferMajority.supported === false
    && transferMostCommon.supported === true;
  const mastery = claimCorrect && transferCorrect;

  function diagnose(choice: DiagnosisChoice): void {
    if (!selectedRowId) return;
    const rowIssues = issues.filter((issue) => issue.rowIds.includes(selectedRowId));
    const matchingIssue = rowIssues.find((issue) => issue.type === choice);

    if (choice === 'CLEAN' && rowIssues.length === 0) {
      setDiagnosisFeedback('Správně — v tomto řádku engine nevidí porušení datových pravidel. Hledej dál.');
      return;
    }

    if (matchingIssue) {
      setDiscoveredIssueIds((current) => current.includes(matchingIssue.id)
        ? current
        : [...current, matchingIssue.id]);
      setDiagnosisFeedback(`Správně: ${issueExplanation(matchingIssue)}`);
      return;
    }

    setDiagnosisFeedback('Tahle diagnóza neodpovídá datovým pravidlům. Zkontroluj identitu, povinné hodnoty a povolené kategorie.');
  }

  function tryResolution(issue: DataIssue, strategy: DataResolutionStrategy): void {
    const candidate: DataResolution = { issueId: issue.id, strategy };
    const preview = resolveDataSet(schema, rows, [...resolutions, candidate]);
    const last = preview.resolutionLog.at(-1);

    if (!last?.applied) {
      setResolutionFeedback('Tento krok by data svévolně změnil nebo odstranil bez důkazu. Bezpečná oprava musí zachovat význam dat.');
      return;
    }

    setResolutions((current) => current.some((resolution) => resolution.issueId === issue.id)
      ? current
      : [...current, candidate]);
    setResolutionFeedback('Bezpečný krok zapsán do logu čištění.');
  }

  return (
    <main className="min-h-screen bg-[#07101f] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">IT-3 · Data Detective</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">Špinavá data, chybný závěr</h1>
            <p className="mt-3 max-w-3xl text-slate-300">
              Školní průzkum tvrdí, že většina žáků chodí pěšky. Než tomu uvěříš, prověř kvalitu evidence. Data nesmíš „opravovat“ odhadem jen proto, aby se lépe hodila k závěru.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-3 text-sm text-cyan-100">
            <strong>{discoveredIssueIds.length}/{issues.length}</strong> problémů nalezeno · <strong>{resolutions.length}/{issues.length}</strong> bezpečně vyřešeno
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="space-y-5">
            <div className="rounded-[30px] border border-white/10 bg-white/[0.035] p-5 shadow-2xl">
              <div className="flex items-start gap-3">
                <Database className="mt-0.5 h-5 w-5 text-cyan-300" aria-hidden="true" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">1 · Prozkoumej evidenci</p>
                  <h2 className="mt-1 text-xl font-black">Jak se žáci dopravují do školy?</h2>
                  <p className="mt-1 text-sm text-slate-400">Pravidla: jeden kód = jeden respondent; doprava je povinná; povoleno je Pěšky / Autobus / Kolo / Auto.</p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                  <thead className="bg-slate-950/80 text-xs uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Řádek</th>
                      <th className="px-4 py-3">Kód</th>
                      <th className="px-4 py-3">Doprava</th>
                      <th className="px-4 py-3">Minuty</th>
                      <th className="px-4 py-3">Kontrola</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const selected = selectedRowId === row.id;
                      const involvedIssue = issues.find((issue) => issue.rowIds.includes(row.id));
                      const discovered = Boolean(involvedIssue && discoveredIssueIds.includes(involvedIssue.id));
                      return (
                        <tr key={row.id} data-testid={`data-row-${row.id}`} className={`border-t border-white/5 ${selected ? 'bg-cyan-300/10' : discovered ? 'bg-amber-300/[0.06]' : 'bg-slate-950/30'}`}>
                          <td className="px-4 py-3 font-black text-slate-500">{index + 1}</td>
                          <td className="px-4 py-3 font-bold">{String(row.values.studentCode)}</td>
                          <td className="px-4 py-3">{row.values.transport === null ? <span className="italic text-slate-600">chybí</span> : transportLabel[String(row.values.transport)] ?? String(row.values.transport)}</td>
                          <td className="px-4 py-3">{String(row.values.minutes)} min</td>
                          <td className="px-4 py-3">
                            <button data-testid={`data-select-${row.id}`} onClick={() => { setSelectedRowId(row.id); setDiagnosisFeedback(null); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black hover:border-cyan-300/30">
                              {selected ? 'Vybráno' : 'Prověřit'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div data-testid="data-raw-summary" className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-50">
                <strong>Naivní výpočet bez čištění:</strong> Pěšky {rawSummary.counts.WALK ?? 0} z {rawSummary.sampleSize} platných kategorií = {formatPercent((rawSummary.counts.WALK ?? 0) / rawSummary.sampleSize)}. Kdybys duplicitu přehlédl, vypadalo by to jako většina.
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 text-amber-200" aria-hidden="true" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">2 · Diagnostikuj</p>
                  <h2 className="text-lg font-black">Co je na vybraném řádku špatně?</h2>
                </div>
              </div>

              {!selectedRowId ? (
                <p className="mt-4 rounded-2xl bg-slate-950/60 p-4 text-sm text-slate-500">Vyber řádek v tabulce. Engine ti problém předem neprozradí.</p>
              ) : (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {diagnosisChoices.map((choice) => (
                    <button key={choice.type} data-testid={`data-diagnose-${choice.type.toLowerCase()}`} onClick={() => diagnose(choice.type)} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-left text-sm font-bold hover:border-amber-200/30">
                      {choice.label}
                    </button>
                  ))}
                </div>
              )}

              {diagnosisFeedback && <p data-testid="data-diagnosis-feedback" className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">{diagnosisFeedback}</p>}
              <p data-testid="data-detected-count" className="mt-3 text-xs font-bold text-slate-500">Nalezeno: {discoveredIssueIds.length}/{issues.length}</p>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[30px] border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center gap-3">
                <Eraser className="h-5 w-5 text-violet-200" aria-hidden="true" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">3 · Vyčisti bez vymýšlení</p>
                  <h2 className="text-lg font-black">Co s nalezenými problémy?</h2>
                </div>
              </div>

              {!allIssuesDetected ? (
                <p className="mt-4 rounded-2xl bg-slate-950/60 p-4 text-sm text-slate-500">Nejdřív najdi všechny tři typy problému. Čištění se neodemkne podle náhody.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {issues.map((issue) => {
                    const resolved = resolutions.some((resolution) => resolution.issueId === issue.id);
                    const safeStrategy = allowedResolutionStrategies(issue)[0]!;
                    const unsafeStrategy: DataResolutionStrategy = safeStrategy === 'REMOVE_DUPLICATE'
                      ? 'EXCLUDE_UNCERTAIN_VALUE'
                      : 'REMOVE_DUPLICATE';
                    return (
                      <div key={issue.id} className={`rounded-2xl border p-4 ${resolved ? 'border-emerald-300/25 bg-emerald-300/10' : 'border-white/10 bg-slate-950/55'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <strong>{issueLabel[issue.type]}</strong>
                          {resolved && <CheckCircle2 className="h-4 w-4 text-emerald-200" aria-hidden="true" />}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{issueExplanation(issue)}</p>
                        {!resolved && (
                          <div className="mt-3 grid gap-2">
                            <button data-testid={`data-resolve-${issue.type.toLowerCase()}-safe`} onClick={() => tryResolution(issue, safeStrategy)} className="rounded-xl bg-emerald-300 px-3 py-2 text-left text-xs font-black text-slate-950">
                              {safeResolutionLabel(issue)}
                            </button>
                            <button data-testid={`data-resolve-${issue.type.toLowerCase()}-unsafe`} onClick={() => tryResolution(issue, unsafeStrategy)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-bold text-slate-400">
                              {unsafeResolutionLabel(issue)}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {resolutionFeedback && <p data-testid="data-resolution-feedback" className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">{resolutionFeedback}</p>}
              <p data-testid="data-resolution-status" className="mt-3 text-xs font-bold text-slate-500">Bezpečně vyřešeno: {resolutions.length}/{issues.length}</p>
            </div>

            {allIssuesResolved && (
              <div className="rounded-[30px] border border-cyan-300/20 bg-cyan-300/[0.06] p-5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-cyan-200" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200/70">4 · Závěr z vyčištěných dat</p>
                    <h2 className="text-lg font-black">„Většina žáků chodí pěšky.“</h2>
                  </div>
                </div>

                <div data-testid="data-clean-summary" className="mt-4 rounded-2xl bg-slate-950/55 p-4 text-sm text-slate-300">
                  Po odstranění duplicity a vyřazení dvou nejistých hodnot z tohoto výpočtu: <strong className="text-white">Pěšky {cleanedClaim.matchingCount} z {cleanedClaim.sampleSize} = {formatPercent(cleanedClaim.share)}</strong>.
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button data-testid="data-claim-yes" onClick={() => setClaimAnswer('YES')} className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 font-black">Ano, je to většina</button>
                  <button data-testid="data-claim-no" onClick={() => setClaimAnswer('NO')} className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 font-black">Ne, není</button>
                </div>

                {claimAnswer && (
                  <p data-testid="data-claim-feedback" className={`mt-3 rounded-xl p-3 text-sm font-bold ${claimCorrect ? 'bg-emerald-300/10 text-emerald-100' : 'bg-amber-300/10 text-amber-100'}`}>
                    {claimCorrect
                      ? 'Správně. 50 % není většina; duplicita před čištěním vytvořila falešný dojem 60 %.'
                      : 'Pozor na význam slova většina: potřebujeme více než polovinu, ne přesně polovinu.'}
                  </p>
                )}
              </div>
            )}

            {claimCorrect && (
              <div className="rounded-[30px] border border-violet-300/20 bg-violet-300/[0.07] p-5">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-violet-200" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200/70">5 · Transfer</p>
                    <h2 className="text-lg font-black">Nejčastější ≠ většina</h2>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-300">V nové, už čisté tabulce jsou 4 odpovědi: Autobus 2×, Pěšky 1×, Kolo 1×. Co platí?</p>
                <div className="mt-3 grid gap-2">
                  <button data-testid="data-transfer-both" onClick={() => setTransferAnswer('BOTH')} className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-3 text-left text-sm font-bold">Autobus je nejčastější a zároveň tvoří většinu.</button>
                  <button data-testid="data-transfer-most_only" onClick={() => setTransferAnswer('MOST_ONLY')} className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-3 text-left text-sm font-bold">Autobus je nejčastější, ale není to většina.</button>
                  <button data-testid="data-transfer-neither" onClick={() => setTransferAnswer('NEITHER')} className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-3 text-left text-sm font-bold">Autobus není ani nejčastější.</button>
                </div>
                {transferAnswer && (
                  <p data-testid="data-transfer-feedback" className={`mt-3 rounded-xl p-3 text-sm font-bold ${transferCorrect ? 'bg-emerald-300/10 text-emerald-100' : 'bg-amber-300/10 text-amber-100'}`}>
                    {transferCorrect
                      ? 'Správně: 2 ze 4 = 50 %, takže autobus není většina. Je ale jediná kategorie s nejvyšším počtem odpovědí.'
                      : 'Zkus oddělit dvě různé otázky: kdo má nejvyšší četnost a kdo má více než polovinu všech platných odpovědí.'}
                  </p>
                )}
              </div>
            )}

            {mastery && (
              <div data-testid="data-mastery" className="rounded-[30px] border border-emerald-300/30 bg-emerald-300/10 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-200" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200/70">IT-3 · Data evidence</p>
                    <h2 className="mt-1 text-xl font-black">Závěr stojí na vyčištěných datech.</h2>
                    <p className="mt-2 text-sm text-slate-300">Našel jsi chyby, neinventoval chybějící hodnoty, odstranil skutečnou duplicitu a odlišil „nejčastější“ od „většina“. To je evidence práce s daty, ne jen dokončená tabulka.</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
