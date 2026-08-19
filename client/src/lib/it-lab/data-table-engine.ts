export type TableFieldType = 'TEXT' | 'NUMBER' | 'BOOLEAN';

export type TableValue = string | number | boolean | null;

export type TableColumn = {
  key: string;
  label: string;
  type: TableFieldType;
  required?: boolean;
  unique?: boolean;
  min?: number;
  max?: number;
};

export type TableRow = {
  id: string;
  values: Record<string, TableValue>;
};

export type TableIssueKind =
  | 'MISSING_REQUIRED'
  | 'TYPE_MISMATCH'
  | 'DUPLICATE'
  | 'OUT_OF_RANGE'
  | 'EVIDENCE_MISMATCH';

export type TableIssue = {
  rowId: string;
  columnKey: string;
  kind: TableIssueKind;
  message: string;
};

export type TableEvidenceAssertion = {
  rowId: string;
  columnKey: string;
  expectedValue: TableValue;
  message?: string;
};

export type TableIdentityIssueKind = 'EXACT_DUPLICATE' | 'CONFLICTING_IDENTITY';

export type TableIdentityIssue = {
  kind: TableIdentityIssueKind;
  columnKey: string;
  value: TableValue;
  rowIds: string[];
};

export type TablePredicate = {
  columnKey: string;
  operator: 'EQ' | 'GTE';
  value: TableValue;
};

export type InformationSystemStage = 'INPUT' | 'VALIDATE' | 'STORE' | 'QUERY' | 'OUTPUT';

export const INFORMATION_SYSTEM_PIPELINE: readonly InformationSystemStage[] = [
  'INPUT',
  'VALIDATE',
  'STORE',
  'QUERY',
  'OUTPUT',
] as const;

function isMissing(value: TableValue | undefined): boolean {
  return value === undefined || value === null || value === '';
}

function matchesType(value: TableValue, type: TableFieldType): boolean {
  if (type === 'TEXT') return typeof value === 'string';
  if (type === 'NUMBER') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === 'boolean';
}

function uniqueValueKey(value: TableValue): string {
  return `${typeof value}:${String(value)}`;
}

function stableRowFingerprint(row: TableRow, columns: TableColumn[]): string {
  return columns
    .map((column) => `${column.key}=${uniqueValueKey(row.values[column.key] ?? null)}`)
    .join('|');
}

export function validateTable(rows: TableRow[], columns: TableColumn[]): TableIssue[] {
  const issues: TableIssue[] = [];
  const seenUniqueValues = new Map<string, Set<string>>();

  for (const column of columns) {
    if (column.unique) seenUniqueValues.set(column.key, new Set<string>());
  }

  for (const row of rows) {
    for (const column of columns) {
      const value = row.values[column.key];

      if (column.required && isMissing(value)) {
        issues.push({
          rowId: row.id,
          columnKey: column.key,
          kind: 'MISSING_REQUIRED',
          message: `${column.label} nesmí být prázdné.`,
        });
        continue;
      }

      if (isMissing(value)) continue;
      const concreteValue = value as TableValue;

      if (!matchesType(concreteValue, column.type)) {
        issues.push({
          rowId: row.id,
          columnKey: column.key,
          kind: 'TYPE_MISMATCH',
          message: `${column.label} má nesprávný datový typ.`,
        });
        continue;
      }

      if (column.type === 'NUMBER' && typeof concreteValue === 'number') {
        if (
          (column.min !== undefined && concreteValue < column.min) ||
          (column.max !== undefined && concreteValue > column.max)
        ) {
          issues.push({
            rowId: row.id,
            columnKey: column.key,
            kind: 'OUT_OF_RANGE',
            message: `${column.label} je mimo povolený rozsah.`,
          });
        }
      }

      if (column.unique) {
        const seen = seenUniqueValues.get(column.key);
        const key = uniqueValueKey(concreteValue);
        if (seen?.has(key)) {
          issues.push({
            rowId: row.id,
            columnKey: column.key,
            kind: 'DUPLICATE',
            message: `${column.label} musí být jedinečné.`,
          });
        } else {
          seen?.add(key);
        }
      }
    }
  }

  return issues;
}

export function validateTableAgainstEvidence(
  rows: TableRow[],
  columns: TableColumn[],
  evidence: readonly TableEvidenceAssertion[],
): TableIssue[] {
  const schemaIssues = validateTable(rows, columns);
  const schemaIssueCells = new Set(
    schemaIssues.map((issue) => `${issue.rowId}:${issue.columnKey}`),
  );
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const columnByKey = new Map(columns.map((column) => [column.key, column]));
  const evidenceIssues: TableIssue[] = [];

  for (const assertion of evidence) {
    const cellKey = `${assertion.rowId}:${assertion.columnKey}`;
    if (schemaIssueCells.has(cellKey)) continue;

    const row = rowById.get(assertion.rowId);
    const column = columnByKey.get(assertion.columnKey);
    if (!row || !column || row.values[assertion.columnKey] !== assertion.expectedValue) {
      evidenceIssues.push({
        rowId: assertion.rowId,
        columnKey: assertion.columnKey,
        kind: 'EVIDENCE_MISMATCH',
        message: assertion.message ?? `${column?.label ?? assertion.columnKey} neodpovídá zdrojovému podkladu.`,
      });
    }
  }

  return [...schemaIssues, ...evidenceIssues];
}

export function inspectIdentityConsistency(
  rows: TableRow[],
  columns: TableColumn[],
  identityKey: string,
): TableIdentityIssue[] {
  const groups = new Map<string, TableRow[]>();

  for (const row of rows) {
    const identity = row.values[identityKey];
    if (isMissing(identity)) continue;
    const key = uniqueValueKey(identity as TableValue);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const issues: TableIdentityIssue[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const fingerprints = new Set(
      group.map((row) => stableRowFingerprint(row, columns)),
    );
    issues.push({
      kind: fingerprints.size === 1 ? 'EXACT_DUPLICATE' : 'CONFLICTING_IDENTITY',
      columnKey: identityKey,
      value: group[0]?.values[identityKey] ?? null,
      rowIds: group.map((row) => row.id),
    });
  }

  return issues;
}

export function updateTableCell(
  rows: TableRow[],
  rowId: string,
  columnKey: string,
  value: TableValue,
): TableRow[] {
  return rows.map((row) =>
    row.id === rowId
      ? { ...row, values: { ...row.values, [columnKey]: value } }
      : row,
  );
}

function predicateMatches(row: TableRow, predicate: TablePredicate): boolean {
  const candidate = row.values[predicate.columnKey];

  if (predicate.operator === 'EQ') return candidate === predicate.value;
  if (typeof candidate !== 'number' || typeof predicate.value !== 'number') return false;
  return candidate >= predicate.value;
}

export function queryTable(rows: TableRow[], predicates: TablePredicate[]): TableRow[] {
  return rows.filter((row) => predicates.every((predicate) => predicateMatches(row, predicate)));
}

function predicateKey(predicate: TablePredicate): string {
  return `${predicate.columnKey}:${predicate.operator}:${typeof predicate.value}:${String(predicate.value)}`;
}

export function samePredicateSet(
  actual: readonly TablePredicate[],
  expected: readonly TablePredicate[],
): boolean {
  if (actual.length !== expected.length) return false;
  const left = actual.map(predicateKey).sort();
  const right = expected.map(predicateKey).sort();
  return left.every((value, index) => value === right[index]);
}

export function isInformationSystemPipelineValid(stages: readonly string[]): boolean {
  return (
    stages.length === INFORMATION_SYSTEM_PIPELINE.length &&
    stages.every((stage, index) => stage === INFORMATION_SYSTEM_PIPELINE[index])
  );
}
