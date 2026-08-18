'use client';

import { useMemo, useState, type JSX } from 'react';
import { AlertTriangle, CheckCircle2, Database, RefreshCcw, Sparkles } from 'lucide-react';
import {
  queryTable,
  updateTableCell,
  validateTable,
  type TableColumn,
  type TableIssue,
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

const evidenceNotes = [
  'Výpůjční lístek Emy má ID A-103.',
  'Jonáš má knihu vypůjčenou 12 dní, ne 42.',
  'Na lístku A-105 je čtenářka Klára.',
];

const decisionOptions = [
  { rowId: 'r1', label: 'Anna' },
  { rowId: 'r2', label: 'Matěj' },
  { rowId: 'r4', label: 'Jonáš' },
];

const systemOptions = [
  { id: 'RAW', label: 'Všechna zadaná data bez pravidel a kontroly' },
  { id: 'REMINDERS', label: 'Seznam čtenářů, kteří splňují pravidlo pro upomínku' },
  { id: 'PASSWORD', label: 'Heslo uživatele, který záznam zadal' },
] as const;

type SystemAnswer = (typeof systemOptions)[number]['id'];

function cellIssue(issues: TableIssue[], rowId: string, columnKey: string): TableIssue | undefined {
  return issues.find((issue) => issue.rowId === rowId && issue.columnKey === columnKey);
}

function textValue(value: TableValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: TableValue | undefined): string {
  return typeof value === 'number' ? String(value) : '';
}

export default function DataLabPage(): JSX.Element {
  const [rows, setRows] = useState<TableRow[]>(initialRows);
  const [decisionRowId, setDecisionRowId] = useState<string | null>(null);
  const [systemAnswer, setSystemAnswer] = useState<SystemAnswer | null>(null);

  const issues = useMemo(() => validateTable(rows, columns), [rows]);
  const isClean = issues.length === 0;
  const overdueRows = useMemo(
    () => queryTable(rows, [
      { columnKey: 'returned', operator: 'EQ', value: false },
      { columnKey: 'daysBorrowed', operator: 'GTE', value: 14 },
    ]),
    [rows],
  );
  const correctDecisionRowId = isClean && overdueRows.length === 1 ? overdueRows[0]?.id ?? null : null;
  const decisionCorrect = decisionRowId !== null && decisionRowId === correctDecisionRowId;
  const systemCorrect = systemAnswer === 'REMINDERS';
  const mastery = isClean && decisionCorrect && systemCorrect;

  function updateCell(rowId: string, columnKey: string, value: TableValue): void {
    setRows((current) => updateTableCell(current, rowId, columnKey, value));
    setDecisionRowId(null);
    setSystemAnswer(null);
  }

  function reset(): void {
    setRows(initialRows);
    setDecisionRowId(null);
    setSystemAnswer(null);
  }

  return (
    <main className="min-h-screen bg-[#07101f] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">IT-3 · Data / Table / Information System</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl" data-testid="data-lab-heading">Data Lab</h1>
            <p className="mt-3 max-w-3xl text-slate-300">
              Evidence knihovny obsahuje chyby. Oprav ji podle skutečných podkladů, potom z čistých dat odvoď informaci a rozhodni, jaký výstup má informační systém vytvořit.
            </p>
          </div>
          <button onClick={reset} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-200 hover:bg-white/10">
            <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Reset mise
          </button>
        </header>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Validace</p>
            <p className="mt-1 text-2xl font-black" data-testid="data-issues-count">{issues.length}</p>
            <p className="text-sm text-slate-400">nekonzistence v evidenci</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Pravidlo upomínky</p>
            <p className="mt-1 font-black text-cyan-200">nevráceno AND ≥ 14 dní</p>
            <p className="text-sm text-slate-400">výstup vzniká z dat + pravidla</p>
          </div>
          <div className={`rounded-2xl border p-4 ${mastery ? 'border-emerald-300/40 bg-emerald-300/10' : 'border-white/10 bg-slate-900/80'}`}>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Evidence</p>
            <p className="mt-1 font-black">{mastery ? 'Princip ověřen' : isClean ? 'Data čistá · pokračuj' : 'Nejdřív oprav data'}</p>
            <p className="text-sm text-slate-400">completion ≠ mastery</p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-5 shadow-2xl">
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
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Najdi první chyby podle pravidel
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
                  <tr>
                    {columns.map((column) => <th key={column.key} className="px-3 py-3">{column.label}</th>)}
                  </tr>
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
                              <input
                                aria-label={`${column.label} ${row.id}`}
                                data-testid={`data-cell-${row.id}-${column.key}`}
                                className={base}
                                inputMode="numeric"
                                type="number"
                                min={0}
                                max={30}
                                value={numberValue(row.values[column.key])}
                                onChange={(event) => updateCell(row.id, column.key, event.target.value === '' ? null : Number(event.target.value))}
                              />
                            ) : (
                              <input
                                aria-label={`${column.label} ${row.id}`}
                                data-testid={`data-cell-${row.id}-${column.key}`}
                                className={base}
                                value={textValue(row.values[column.key])}
                                onChange={(event) => updateCell(row.id, column.key, event.target.value)}
                              />
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

          <div className="grid gap-5">
            <section className={`rounded-3xl border p-5 ${isClean ? 'border-cyan-300/20 bg-cyan-300/[0.05]' : 'border-white/10 bg-slate-900/75 opacity-70'}`}>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">2 · Data → informace</p>
              <h2 className="mt-1 text-xl font-black">Kdo má dostat upomínku?</h2>
              <p className="mt-2 text-sm text-slate-300">Použij pravidlo <strong>nevráceno AND alespoň 14 dní</strong>. Otázka se odemyká až nad konzistentními daty.</p>
              <div className="mt-4 grid gap-2">
                {decisionOptions.map((option) => (
                  <button
                    key={option.rowId}
                    disabled={!isClean}
                    data-testid={`data-decision-${option.rowId}`}
                    onClick={() => setDecisionRowId(option.rowId)}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-left font-black disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {decisionRowId && (
                <div data-testid="data-decision-result" className={`mt-4 rounded-2xl p-3 text-sm font-bold ${decisionCorrect ? 'bg-emerald-300/10 text-emerald-100' : 'bg-rose-300/10 text-rose-100'}`}>
                  {decisionCorrect
                    ? 'Správně. Matěj má 18 dní a kniha není vrácená. Rozhodnutí je doložené dvěma datovými podmínkami.'
                    : 'Tato volba neodpovídá oběma podmínkám. Zkontroluj stav vrácení i počet dní.'}
                </div>
              )}
            </section>

            <section className={`rounded-3xl border p-5 ${decisionCorrect ? 'border-violet-300/20 bg-violet-300/[0.05]' : 'border-white/10 bg-slate-900/75 opacity-70'}`}>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-violet-300" aria-hidden="true" />
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">3 · Informační systém</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black sm:grid-cols-4 xl:grid-cols-2">
                {['INPUT · lístek', 'RULE · validace', 'STORE · tabulka', 'OUTPUT · ?'].map((step) => (
                  <div key={step} className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 text-center text-slate-300">{step}</div>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-300">Který výstup dává knihovníkovi smysl, pokud systém právě vyhodnotil pravidlo pro upomínku?</p>
              <div className="mt-3 grid gap-2">
                {systemOptions.map((option) => (
                  <button
                    key={option.id}
                    disabled={!decisionCorrect}
                    data-testid={`data-system-${option.id.toLowerCase()}`}
                    onClick={() => setSystemAnswer(option.id)}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-left text-sm font-bold disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {systemAnswer && (
                <div data-testid="data-system-result" className={`mt-4 rounded-2xl p-3 text-sm font-bold ${systemCorrect ? 'bg-emerald-300/10 text-emerald-100' : 'bg-rose-300/10 text-rose-100'}`}>
                  {systemCorrect
                    ? 'Správně. Informační systém převádí vstupní data pomocí pravidel na užitečný výstup pro konkrétního uživatele.'
                    : 'Tohle není užitečný výstup daného procesu. Vrať se k účelu systému a potřebě knihovníka.'}
                </div>
              )}
            </section>
          </div>
        </div>

        {mastery && (
          <section data-testid="data-mastery" className="mt-5 rounded-3xl border border-emerald-300/30 bg-emerald-300/10 p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 h-5 w-5 text-emerald-200" aria-hidden="true" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Learning evidence</p>
                <h2 className="mt-1 text-xl font-black">Princip ověřen na celé datové cestě</h2>
                <p className="mt-2 text-sm text-emerald-50/90">Žák opravil nekonzistentní evidenci podle zdroje, odvodil informaci pomocí pravidla a rozpoznal účel výstupu informačního systému.</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
