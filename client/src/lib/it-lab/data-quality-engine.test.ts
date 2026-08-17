import { describe, expect, it } from 'vitest';
import {
  allowedResolutionStrategies,
  evaluateCategoryClaim,
  inspectDataSet,
  resolveDataSet,
  summarizeCategory,
  type DataRow,
  type DataTableSchema,
} from './data-quality-engine';

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

const dirtyRows: DataRow[] = [
  { id: 'r1', values: { studentCode: 'A15', transport: 'WALK', minutes: 10 } },
  { id: 'r2', values: { studentCode: 'B07', transport: 'WALK', minutes: 12 } },
  { id: 'r3', values: { studentCode: 'C21', transport: 'BUS', minutes: 25 } },
  { id: 'r4', values: { studentCode: 'D04', transport: 'BIKE', minutes: 18 } },
  { id: 'r5', values: { studentCode: 'B07', transport: 'WALK', minutes: 12 } },
  { id: 'r6', values: { studentCode: 'E11', transport: null, minutes: 20 } },
  { id: 'r7', values: { studentCode: 'F12', transport: 'TELEPORT', minutes: 30 } },
];

function safeResolutions(rows: DataRow[]) {
  return inspectDataSet(schema, rows).map((issue) => ({
    issueId: issue.id,
    strategy: allowedResolutionStrategies(issue)[0]!,
  }));
}

describe('data quality engine', () => {
  it('detects missing, invalid and exact duplicate data deterministically', () => {
    const issues = inspectDataSet(schema, dirtyRows);

    expect(issues.map((issue) => issue.type)).toEqual([
      'MISSING_REQUIRED',
      'INVALID_CATEGORY',
      'EXACT_DUPLICATE',
    ]);
    expect(issues.find((issue) => issue.type === 'EXACT_DUPLICATE')?.rowIds).toEqual(['r2', 'r5']);
    expect(issues.find((issue) => issue.type === 'MISSING_REQUIRED')?.field).toBe('transport');
    expect(issues.find((issue) => issue.type === 'INVALID_CATEGORY')?.value).toBe('TELEPORT');
  });

  it('does not treat conflicting records with one identity as a safe exact duplicate', () => {
    const rows: DataRow[] = [
      { id: 'a', values: { studentCode: 'X01', transport: 'WALK', minutes: 8 } },
      { id: 'b', values: { studentCode: 'X01', transport: 'BUS', minutes: 20 } },
    ];

    const [issue] = inspectDataSet(schema, rows);
    expect(issue?.type).toBe('CONFLICTING_IDENTITY');
    expect(allowedResolutionStrategies(issue!)).toEqual(['FLAG_FOR_REVIEW']);
  });

  it('rejects a resolution strategy that would invent or delete uncertain data', () => {
    const missing = inspectDataSet(schema, dirtyRows).find((issue) => issue.type === 'MISSING_REQUIRED')!;
    const result = resolveDataSet(schema, dirtyRows, [
      { issueId: missing.id, strategy: 'REMOVE_DUPLICATE' },
    ]);

    expect(result.resolutionLog).toEqual([
      { issueId: missing.id, strategy: 'REMOVE_DUPLICATE', applied: false },
    ]);
    expect(result.unresolvedIssueIds).toContain(missing.id);
  });

  it('shows how an exact duplicate can create a false majority before cleaning', () => {
    const raw = summarizeCategory(schema, dirtyRows, 'transport');
    expect(raw.sampleSize).toBe(5);
    expect(raw.counts).toEqual({ WALK: 3, BUS: 1, BIKE: 1 });

    const resolved = resolveDataSet(schema, dirtyRows, safeResolutions(dirtyRows));
    const claim = evaluateCategoryClaim(schema, resolved, {
      field: 'transport',
      value: 'WALK',
      kind: 'MAJORITY',
    });

    expect(resolved.unresolvedIssueIds).toEqual([]);
    expect(resolved.removedRowIds).toEqual(['r5']);
    expect(resolved.excludedCells.sort()).toEqual(['r6:transport', 'r7:transport']);
    expect(claim).toMatchObject({
      ready: true,
      supported: false,
      sampleSize: 4,
      matchingCount: 2,
      share: 0.5,
      counts: { WALK: 2, BUS: 1, BIKE: 1 },
    });
  });

  it('distinguishes most-common from majority', () => {
    const rows: DataRow[] = [
      { id: 't1', values: { studentCode: 'H01', transport: 'BUS', minutes: 15 } },
      { id: 't2', values: { studentCode: 'H02', transport: 'BUS', minutes: 20 } },
      { id: 't3', values: { studentCode: 'H03', transport: 'WALK', minutes: 8 } },
      { id: 't4', values: { studentCode: 'H04', transport: 'BIKE', minutes: 12 } },
    ];
    const resolved = resolveDataSet(schema, rows, []);

    expect(evaluateCategoryClaim(schema, resolved, {
      field: 'transport',
      value: 'BUS',
      kind: 'MAJORITY',
    }).supported).toBe(false);

    expect(evaluateCategoryClaim(schema, resolved, {
      field: 'transport',
      value: 'BUS',
      kind: 'MOST_COMMON',
    }).supported).toBe(true);
  });

  it('will not evaluate a claim as ready while a data-quality issue is unresolved', () => {
    const issues = inspectDataSet(schema, dirtyRows);
    const duplicate = issues.find((issue) => issue.type === 'EXACT_DUPLICATE')!;
    const partial = resolveDataSet(schema, dirtyRows, [
      { issueId: duplicate.id, strategy: 'REMOVE_DUPLICATE' },
    ]);

    expect(evaluateCategoryClaim(schema, partial, {
      field: 'transport',
      value: 'WALK',
      kind: 'MAJORITY',
    })).toMatchObject({ ready: false, supported: null });
  });
});
