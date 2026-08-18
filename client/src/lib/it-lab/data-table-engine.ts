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
  | 'OUT_OF_RANGE';

export type TableIssue = {
  rowId: string;
  columnKey: string;
  kind: TableIssueKind;
  message: string;
};

export type TablePredicate = {
  columnKey: string;
  operator: 'EQ' | 'GTE';
  value: TableValue;
};

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
