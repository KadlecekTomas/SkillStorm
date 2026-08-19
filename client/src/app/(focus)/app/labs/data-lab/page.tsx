'use client';

import { useMemo, useState, type JSX } from 'react';
import { AlertTriangle, CheckCircle2, Database, RefreshCcw, Sparkles } from 'lucide-react';
import {
  isInformationSystemPipelineValid,
  queryTable,
  samePredicateSet,
  updateTableCell,
  validateTableAgainstEvidence,
  type InformationSystemStage,
  type TableColumn,
  type TableEvidenceAssertion,
  type TableIssue,
  type TablePredicate,
  type TableRow,
  type TableValue,
} from '@/lib/it-lab/data-table-engine';

const columns: TableColumn[] = [
  { key: 'code', label: 'ID', type: 'TEXT', required: true, unique: true },
  { key: 'borrower', label: 'Čtenář', type: 'TEXT', required: true },
  { key: 'className', label: 'Třída', type: 'TEXT', required: true },
  { key: 'item', label: 'Kniha', type: 'TEXT', required: true },
  { key: 'daysBorrowed', label: 'Dní', type: 'NUMBER', required: true, min: 0, max: 30 },
  { key: 'returned', label: 'Vráceno', type: 'BOOLEAN', required: true },
];

const initialRows: TableRow[] = [
  { id: 'r1', values: { code: 'A-101', borrower: 'Anna', className: '4.A', item: 'Robotika pro děti', daysBorrowed: 5, returned: false } },
  { id: 'r2', values: { code: 'A-102', borrower: 'Matěj', className: '4.A', item: 'Základy programování', daysBorrowed: 18, returned: false } },
  { id: 'r3', values: { code: 'A-102', borrower: 'Ema', className: '4.B', item: 'Internet bezpečně', daysBorrowed: 9, returned: true } },
  { id: 'r4', values: { code: 'A-104', borrower: 'Jonáš', className: '4.B', item: 'Počítače kolem nás', daysBorrowed: 42, returned: false } },
  { id: 'r5', values: { code: 'A-105', borrower: '', className: '4.A', item: 'Datový detektiv', daysBorrowed: 3, returned: false } },
];

const transferRows: TableRow[] = [
  { id: 't1', values: { code: 'B-201', borrower: 'Tereza', className: '5.A', item: 'Sítě kolem nás', daysBorrowed: 16, returned: false } },
  { id: 't2', values: { code: 'B-202', borrower: 'David', className: '5.A', item: 'Robotické mise', daysBorrowed: 22, returned: true } },
  { id: 't3', values: { code: 'B-203', borrower: 'Nina', className: '5.B', item: 'Data v praxi', daysBorrowed: 8, returned: false } },
];

const evidenceNotes = [
  'Výpůjční lístek Emy má ID A-103.',
  'Jonáš má knihu vypůjčenou 12 dní, ne 42.',
  'Na lístku A-105 je čtenářka Klára.',
];

const evidenceAssertions: TableEvidenceAssertion[] = [
  {
    rowId: 'r3',
    columnKey: 'code',
    expectedValue: 'A-103',
    message: 'Zdrojový podklad potvrzuje pro Emu ID A-103.',
  },
  {
    rowId: 'r4',
    columnKey: 'daysBorrowed',
    expectedValue: 12,
    message: 'Zdrojový podklad potvrzuje 12 dní.',
  },
  {
    rowId: 'r5',
    columnKey: 'borrower',
    expectedValue: 'Klára',
    message: 'Zdrojový podklad potvrzuje čtenářku Kláru.',
  },
];

const tableRuleOptions = [
  { id: 'UNIQUE_ID', label: 'ID záznamu musí být jedinečné', detail: 'jinak nejde bezpečně rozlišit dva záznamy' },
  { id: 'REQUIRED_BORROWER', label: 'Čtenář je povinný údaj', detail: 'bez něj nevíme, komu výpůjčka patří' },
  { id: 'DAYS_RANGE', label: 'Dny jsou číslo 0–30', detail: 'evidence odmítne nesmyslný rozsah' },
  { id: 'UNIQUE_BOOK', label: 'Název knihy musí být vždy jedinečný', detail: 'to by zakázalo dvěma žákům půjčit stejný titul' },
] as const;

const requiredTableRuleIds = ['UNIQUE_ID', 'REQUIRED_BORROWER', 'DAYS_RANGE'] as const;

type TableRuleId = (typeof tableRuleOptions)[number]['id'];

const reminderRule: TablePredicate[] = [
  { columnKey: 'returned', operator: 'EQ', value: false },
  { columnKey: 'daysBorrowed', operator: 'GTE', value: 14 },
];

const pipelineOptions: Array<{
  id: InformationSystemStage | 'SHARE_PASSWORD';
  label: string;
  detail: string;
}> = [
  { id: 'INPUT', label: 'INPUT', detail: 'načti výpůjční lístek' },
  { id: 'VALIDATE', label: 'VALIDATE', detail: 'ověř pravidla evidence' },
  { id: 'STORE', label: 'STORE', detail: 'ulož čistý záznam' },
  { id: 'QUERY', label: 'QUERY', detail: 'vyhodnoť pravidlo upomínky' },
  { id: 'OUTPUT', label: 'OUTPUT', detail: 'ukaž seznam pro knihovníka' },
  { id: 'SHARE_PASSWORD', label: 'SHARE PASSWORD', detail: 'pošli heslo uživatele dál' },
];

type PipelineChoice = (typeof pipelineOptions)[number]['id'];

function cellIssue(issues: TableIssue[], rowId: string, columnKey: string): TableIssue | undefined {
  return issues.find((issue) => issue.rowId === rowId && issue.columnKey === columnKey);
}

function textValue(value: TableValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: TableValue | undefined): string {
  return typeof value === 'number' ? String(value) : '';
}

function sameStringSet(actual: readonly string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) return false;
  const left = [...actual].sort();
  const right = [...expected].sort();
  return left.every((value, index) => value === right[index]);
}

function borrowerName(row: TableRow): string {
  return typeof row.values.borrower === 'string' ? row.values.borrower : 'Neznámý';
}

export default function DataLabPage(): JSX.Element {
  const [rows, setRows] = useState<TableRow[]>(initialRows);
  const [selectedTableRules, setSelectedTableRules] = useState<TableRuleId[]>([]);
  const [returnedFilter, setReturnedFilter] = useState<boolean | null>(null);
  const [daysThreshold, setDaysThreshold] = useState<number | null>(null);
  const [pipeline, setPipeline] = useState<PipelineChoice[]>([]);
  const [transferAnswer, setTransferAnswer] = useState<string | null>(null);

  const issues = useMemo(
    () => validateTableAgainstEvidence(rows, columns, evidenceAssertions),
    [rows],
  );
  const isClean = issues.length === 0;
  const tableRulesCorrect = sameStringSet(selectedTableRules, requiredTableRuleIds);

  const learnerPredicates = useMemo<TablePredicate[]>(() => {
    if (returnedFilter === null || daysThreshold === null) return [];
    return [
      { columnKey: 'returned', operator: 'EQ', value: returnedFilter },
      { columnKey: 'daysBorrowed', operator: 'GTE', value: daysThreshold },
    ];
  }, [returnedFilter, daysThreshold]);

  const queryConfigured = learnerPredicates.length === 2;
  const queryResults = useMemo(
    () => (isClean && tableRulesCorrect && queryConfigured ? queryTable(rows, learnerPredicates) : []),
    [isClean, learnerPredicates, queryConfigured, rows, tableRulesCorrect],
  );
  const queryCorrect = queryConfigured && samePredicateSet(learnerPredicates, reminderRule);
  const pipelineCorrect = isInformationSystemPipelineValid(pipeline);
  const transferExpected = useMemo(() => queryTable(transferRows, reminderRule), []);
  const transferCorrect = transferAnswer !== null && transferExpected.some((row) => row.id === transferAnswer);
  const mastery = isClean && tableRulesCorrect && queryCorrect && pipelineCorrect && transferCorrect;

  function clearDownstream(): void {
    setReturnedFilter(null);
    setDaysThreshold(null);
    setPipeline([]);
    setTransferAnswer(null);
  }

  function updateCell(rowId: string, columnKey: string, value: TableValue): void {
    setRows((current) => updateTableCell(current, rowId, columnKey, value));
    clearDownstream();
  }

  function toggleTableRule(id: TableRuleId): void {
    if (!isClean) return;
    setSelectedTableRules((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
    clearDownstream();
  }

  function appendPipelineStage(stage: PipelineChoice): void {
    if (!queryCorrect || pipeline.length >= 5 || pipeline.includes(stage)) return;
    setPipeline((current) => [...current, stage]);
    setTransferAnswer(null);
  }

  function reset(): void {
    setRows(initialRows);
    setSelectedTableRules([]);
    setReturnedFilter(null);
    setDaysThreshold(null);
    setPipeline([]);
    setTransferAnswer(null);
  }

  return (
    <main className="min-h-screen bg-[#07101f] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">IT-3 · Data / Table / Information System</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl" data-testid="data-lab-heading">Data Lab</h1>
            <p className="mt-3 max-w-3xl text-slate-300">
              Oprav špinavou evidenci, navrhni pravidla tabulky, sestav dotaz, postav datovou cestu informačního systému a ověř princip na nových datech.
            </p>
          </div>
          <button data-testid="data-reset" onClick={reset} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-200 hover:bg-white/10">
            <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Reset mise
          </button>
        </header>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['1', 'Data', isClean ? 'HOTOVO' : `${issues.length} chyby`],
            ['2', 'Pravidla', tableRulesCorrect ? 'HOTOVO' : 'čeká'],
            ['3', 'Dotaz', queryCorrect ? 'HOTOVO' : 'čeká'],
            ['4', 'Systém', pipelineCorrect ? 'HOTOVO' : 'čeká'],
            ['5', 'Transfer', transferCorrect ? 'HOTOVO' : 'čeká'],
          ].map(([number, label, status]) => (
            <div key={number} className={`rounded-2xl border p-4 ${status === 'HOTOVO' ? 'border-emerald-300/30 bg-emerald-300/10' : 'border-white/10 bg-slate-900/80'}`}>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Checkpoint {number}</p>
              <p className="mt-1 font-black">{label}</p>
              <p className={`text-xs font-bold ${status === 'HOTOVO' ? 'text-emerald-200' : 'text-slate-400'}`}>{status}</p>
            </div>
          ))}
        </div>

        <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-5 shadow-2xl" data-testid="data-stage-clean">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">1 · Data Detective</p>
              <h2 className="mt-1 text-xl font-black">Evidence výpůjček</h2>
            </div>
            {isClean ? (
              <span data-testid="data-clean" className="inline-flex items-center gap-2 rounded-full bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-200">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Data jsou konzistentní
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-300/10 px-3 py-2 text-xs font-black text-rose-200">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" /> <span data-testid="data-issues-count">{issues.length}</span> nekonzistence
              </span>
            )}
          </div>

          <div className="mb-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-4">
            <p className="text-xs font-black uppercase tracking-wider text-amber-200">Zdrojové podklady</p>
            <ul className="mt-2 grid gap-1 text-sm text-amber-50/90">
              {evidenceNotes.map((note) => <li key={note}>• {note}</li>)}
            </ul>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-700">
            <table className="min-w-[900px] w-full border-collapse text-sm">
              <thead className="bg-slate-950/80 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>{columns.map((column) => <th key={column.key} className="px-3 py-3">{column.label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-800 bg-slate-950/30 align-top">
                    {columns.map((column) => {
                      const issue = cellIssue(issues, row.id, column.key);
                      const base = `w-full rounded-xl border px-3 py-2 outline-none transition ${issue ? 'border-rose-300/50 bg-rose-300/10 text-rose-50 focus:border-rose-200' : 'border-slate-700 bg-slate-900 text-slate-100 focus:border-cyan-300/50'}`;

                      return (
                        <td key={column.key} className="px-2 py-2">
                          {column.key === 'returned' ? (
                            <span className={`inline-flex rounded-full px-3 py-2 text-xs font-black ${row.values.returned ? 'bg-emerald-300/10 text-emerald-200' : 'bg-slate-700/60 text-slate-200'}`}>
                              {row.values.returned ? 'ANO' : 'NE'}
                            </span>
                          ) : column.key === 'daysBorrowed' ? (
                            <input aria-label={`${column.label} ${row.id}`} data-testid={`data-cell-${row.id}-${column.key}`} className={base} inputMode="numeric" type="number" min={0} max={30} value={numberValue(row.values[column.key])} onChange={(event) => updateCell(row.id, column.key, event.target.value === '' ? null : Number(event.target.value))} />
                          ) : (
                            <input aria-label={`${column.label} ${row.id}`} data-testid={`data-cell-${row.id}-${column.key}`} className={base} value={textValue(row.values[column.key])} onChange={(event) => updateCell(row.id, column.key, event.target.value)} />
                          )}
                          {issue && <p className="mt-1 max-w-40 text-[11px] font-bold leading-tight text-rose-200">{issue.message}</p>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <section data-testid="data-stage-rules" className={`rounded-3xl border p-5 ${isClean ? 'border-cyan-300/20 bg-cyan-300/[0.05]' : 'border-white/10 bg-slate-900/75 opacity-55'}`}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">2 · Table Lab</p>
            <h2 className="mt-1 text-xl font-black">Jaká pravidla má evidence hlídat?</h2>
            <p className="mt-2 text-sm text-slate-300">Vyber právě pravidla, která chrání význam této tabulky. Ne každé „přísnější“ pravidlo je správné.</p>
            <div className="mt-4 grid gap-2">
              {tableRuleOptions.map((option) => {
                const selected = selectedTableRules.includes(option.id);
                return (
                  <button key={option.id} disabled={!isClean} data-testid={`data-rule-${option.id.toLowerCase()}`} onClick={() => toggleTableRule(option.id)} className={`rounded-2xl border px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-35 ${selected ? 'border-cyan-300/40 bg-cyan-300/10' : 'border-white/10 bg-slate-950/60'}`}>
                    <span className="block font-black">{selected ? '✓ ' : ''}{option.label}</span>
                    <span className="mt-1 block text-xs text-slate-400">{option.detail}</span>
                  </button>
                );
              })}
            </div>
            {isClean && selectedTableRules.length > 0 && (
              <div data-testid="data-rules-result" className={`mt-4 rounded-2xl p-3 text-sm font-bold ${tableRulesCorrect ? 'bg-emerald-300/10 text-emerald-100' : 'bg-amber-300/10 text-amber-100'}`}>
                {tableRulesCorrect ? 'Správně. Schéma chrání identitu záznamu, povinného čtenáře i smysluplný číselný rozsah.' : 'Ještě ne. Zkontroluj, které pravidlo chrání data a které by naopak zakázalo legitimní záznam.'}
              </div>
            )}
          </section>

          <section data-testid="data-stage-query" className={`rounded-3xl border p-5 ${tableRulesCorrect ? 'border-violet-300/20 bg-violet-300/[0.05]' : 'border-white/10 bg-slate-900/75 opacity-55'}`}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">3 · Query Builder</p>
            <h2 className="mt-1 text-xl font-black">Sestav pravidlo pro upomínku</h2>
            <p className="mt-2 text-sm text-slate-300">Knihovna chce upozornit jen na <strong>nevrácené</strong> výpůjčky staré <strong>alespoň 14 dní</strong>. Sestav dotaz, nehádej jméno.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Vráceno =</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button disabled={!tableRulesCorrect} data-testid="data-query-returned-false" onClick={() => setReturnedFilter(false)} className={`rounded-xl px-3 py-2 text-sm font-black ${returnedFilter === false ? 'bg-violet-300 text-slate-950' : 'bg-white/5 text-slate-200'}`}>NE</button>
                  <button disabled={!tableRulesCorrect} data-testid="data-query-returned-true" onClick={() => setReturnedFilter(true)} className={`rounded-xl px-3 py-2 text-sm font-black ${returnedFilter === true ? 'bg-violet-300 text-slate-950' : 'bg-white/5 text-slate-200'}`}>ANO</button>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Dní ≥</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[7, 14, 21].map((threshold) => (
                    <button key={threshold} disabled={!tableRulesCorrect} data-testid={`data-query-days-${threshold}`} onClick={() => setDaysThreshold(threshold)} className={`rounded-xl px-3 py-2 text-sm font-black ${daysThreshold === threshold ? 'bg-violet-300 text-slate-950' : 'bg-white/5 text-slate-200'}`}>{threshold}</button>
                  ))}
                </div>
              </div>
            </div>

            {queryConfigured && tableRulesCorrect && (
              <div data-testid="data-query-result" className={`mt-4 rounded-2xl p-4 ${queryCorrect ? 'bg-emerald-300/10 text-emerald-100' : 'bg-rose-300/10 text-rose-100'}`}>
                <p className="text-xs font-black uppercase tracking-wider">Výsledek dotazu · {queryResults.length} záznamů</p>
                <p className="mt-1 font-black">{queryResults.length ? queryResults.map(borrowerName).join(', ') : 'Nikdo'}</p>
                <p className="mt-2 text-sm font-bold">{queryCorrect ? 'Pravidlo sedí: Matěj je odvozený z dat, ne natvrdo z UI.' : 'Tento dotaz neodpovídá přesně zadání. Porovnej obě podmínky.'}</p>
              </div>
            )}
          </section>
        </div>

        <section data-testid="data-stage-system" className={`mt-5 rounded-3xl border p-5 ${queryCorrect ? 'border-fuchsia-300/20 bg-fuchsia-300/[0.05]' : 'border-white/10 bg-slate-900/75 opacity-55'}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-fuchsia-300" aria-hidden="true" />
                <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">4 · Information System Builder</p>
              </div>
              <h2 className="mt-1 text-xl font-black">Postav datovou cestu systému</h2>
              <p className="mt-2 text-sm text-slate-300">Klikni na pět kroků ve správném pořadí. Jeden z nabízených kroků do bezpečného systému vůbec nepatří.</p>
            </div>
            <button data-testid="data-pipeline-clear" disabled={!queryCorrect || pipeline.length === 0} onClick={() => setPipeline([])} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black disabled:opacity-35">Vyčistit pipeline</button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {pipelineOptions.map((option) => {
              const used = pipeline.includes(option.id);
              return (
                <button key={option.id} disabled={!queryCorrect || used || pipeline.length >= 5} data-testid={`data-pipeline-${option.id.toLowerCase().replace('_', '-')}`} onClick={() => appendPipelineStage(option.id)} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left disabled:cursor-not-allowed disabled:opacity-30">
                  <span className="block font-black text-fuchsia-100">{option.label}</span>
                  <span className="mt-1 block text-xs text-slate-400">{option.detail}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-5" data-testid="data-pipeline-sequence">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className={`rounded-2xl border px-3 py-4 text-center text-xs font-black ${pipeline[index] ? 'border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-100' : 'border-dashed border-white/10 text-slate-600'}`}>
                {index + 1}. {pipeline[index] ?? '—'}
              </div>
            ))}
          </div>

          {pipeline.length === 5 && (
            <div data-testid="data-pipeline-result" className={`mt-4 rounded-2xl p-4 text-sm font-bold ${pipelineCorrect ? 'bg-emerald-300/10 text-emerald-100' : 'bg-rose-300/10 text-rose-100'}`}>
              {pipelineCorrect ? 'Správně. Systém nejdřív přijme data, ověří je, uloží, zpracuje dotaz a až potom vytvoří užitečný výstup.' : 'Pipeline není bezpečná nebo logická. Vstup musí projít kontrolou před uložením a výstup vzniká až po zpracování.'}
            </div>
          )}
        </section>

        <section data-testid="data-stage-transfer" className={`mt-5 rounded-3xl border p-5 ${pipelineCorrect ? 'border-emerald-300/20 bg-emerald-300/[0.05]' : 'border-white/10 bg-slate-900/75 opacity-55'}`}>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">5 · Transfer</p>
          <h2 className="mt-1 text-xl font-black">Nová třída, stejný princip</h2>
          <p className="mt-2 text-sm text-slate-300">Bez nápovědy použij stejné pravidlo <strong>nevráceno AND ≥ 14 dní</strong> na nový dataset. Completion z předchozí tabulky nestačí.</p>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-700">
            <table className="min-w-[650px] w-full text-sm">
              <thead className="bg-slate-950/80 text-left text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Čtenář</th><th className="px-3 py-3">Třída</th><th className="px-3 py-3">Kniha</th><th className="px-3 py-3">Dní</th><th className="px-3 py-3">Vráceno</th></tr></thead>
              <tbody>{transferRows.map((row) => <tr key={row.id} className="border-t border-slate-800 bg-slate-950/30"><td className="px-3 py-3 font-black">{borrowerName(row)}</td><td className="px-3 py-3">{String(row.values.className)}</td><td className="px-3 py-3">{String(row.values.item)}</td><td className="px-3 py-3">{String(row.values.daysBorrowed)}</td><td className="px-3 py-3">{row.values.returned ? 'ANO' : 'NE'}</td></tr>)}</tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {transferRows.map((row) => (
              <button key={row.id} disabled={!pipelineCorrect} data-testid={`data-transfer-${row.id}`} onClick={() => setTransferAnswer(row.id)} className={`rounded-2xl border px-4 py-3 text-left font-black disabled:opacity-35 ${transferAnswer === row.id ? 'border-emerald-300/40 bg-emerald-300/10' : 'border-white/10 bg-slate-950/60'}`}>{borrowerName(row)}</button>
            ))}
          </div>

          {transferAnswer && (
            <div data-testid="data-transfer-result" className={`mt-4 rounded-2xl p-4 text-sm font-bold ${transferCorrect ? 'bg-emerald-300/10 text-emerald-100' : 'bg-rose-300/10 text-rose-100'}`}>
              {transferCorrect ? 'Správně. Tereza splňuje obě podmínky. Stejný datový princip funguje i na změněné situaci.' : 'Ne. Znovu aplikuj obě podmínky současně — počet dní sám o sobě nestačí.'}
            </div>
          )}
        </section>

        {mastery && (
          <section data-testid="data-mastery" className="mt-5 rounded-3xl border border-emerald-300/30 bg-emerald-300/10 p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 h-5 w-5 text-emerald-200" aria-hidden="true" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Learning evidence · IT-3</p>
                <h2 className="mt-1 text-xl font-black">Data → pravidla → dotaz → systém → transfer</h2>
                <p className="mt-2 text-sm text-emerald-50/90">Žák opravil nekonzistentní data podle zdroje, rozpoznal pravidla kvalitní evidence, sám sestavil datový dotaz, postavil bezpečnou datovou cestu informačního systému a přenesl princip na nový dataset.</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}