export type DataCellValue = string | number | null;

export type DataColumnType = 'TEXT' | 'NUMBER' | 'CATEGORY';

export type DataColumnSchema = {
  key: string;
  label: string;
  type: DataColumnType;
  required?: boolean;
  allowedValues?: string[];
};

export type DataTableSchema = {
  columns: DataColumnSchema[];
  identityKey?: string;
};

export type DataRow = {
  id: string;
  values: Record<string, DataCellValue>;
};

export type DataIssueType =
  | 'MISSING_REQUIRED'
  | 'INVALID_CATEGORY'
  | 'EXACT_DUPLICATE'
  | 'CONFLICTING_IDENTITY';

export type DataIssue = {
  id: string;
  type: DataIssueType;
  rowIds: string[];
  field?: string;
  value?: DataCellValue;
};

export type DataResolutionStrategy =
  | 'REMOVE_DUPLICATE'
  | 'EXCLUDE_UNCERTAIN_VALUE'
  | 'FLAG_FOR_REVIEW';

export type DataResolution = {
  issueId: string;
  strategy: DataResolutionStrategy;
};

export type ResolutionLogEntry = {
  issueId: string;
  strategy: DataResolutionStrategy;
  applied: boolean;
};

export type ResolvedDataSet = {
  rows: DataRow[];
  issues: DataIssue[];
  unresolvedIssueIds: string[];
  excludedCells: string[];
  removedRowIds: string[];
  resolutionLog: ResolutionLogEntry[];
};

export type CategorySummary = {
  field: string;
  sampleSize: number;
  counts: Record<string, number>;
};

export type CategoryClaimKind = 'MAJORITY' | 'MOST_COMMON';

export type CategoryClaim = {
  field: string;
  value: string;
  kind: CategoryClaimKind;
};

export type CategoryClaimEvaluation = {
  ready: boolean;
  supported: boolean | null;
  sampleSize: number;
  matchingCount: number;
  share: number | null;
  counts: Record<string, number>;
};

function isMissing(value: DataCellValue | undefined): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function stableValue(value: DataCellValue | undefined): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  return `${typeof value}:${String(value)}`;
}

function rowFingerprint(row: DataRow, columns: DataColumnSchema[]): string {
  return columns.map((column) => `${column.key}=${stableValue(row.values[column.key])}`).join('|');
}

function cellKey(rowId: string, field: string): string {
  return `${rowId}:${field}`;
}

export function inspectDataSet(schema: DataTableSchema, rows: DataRow[]): DataIssue[] {
  const issues: DataIssue[] = [];

  for (const row of rows) {
    for (const column of schema.columns) {
      const value = row.values[column.key];

      if (column.required && isMissing(value)) {
        issues.push({
          id: `missing:${row.id}:${column.key}`,
          type: 'MISSING_REQUIRED',
          rowIds: [row.id],
          field: column.key,
          value: value ?? null,
        });
        continue;
      }

      if (
        column.type === 'CATEGORY'
        && !isMissing(value)
        && column.allowedValues
        && !column.allowedValues.includes(String(value))
      ) {
        issues.push({
          id: `invalid:${row.id}:${column.key}:${String(value)}`,
          type: 'INVALID_CATEGORY',
          rowIds: [row.id],
          field: column.key,
          value: value ?? null,
        });
      }
    }
  }

  if (schema.identityKey) {
    const groups = new Map<string, DataRow[]>();
    for (const row of rows) {
      const identity = row.values[schema.identityKey];
      if (isMissing(identity)) continue;
      const key = stableValue(identity);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    for (const [identity, group] of groups) {
      if (group.length < 2) continue;
      const fingerprints = new Set(group.map((row) => rowFingerprint(row, schema.columns)));
      const rowIds = group.map((row) => row.id);
      const exact = fingerprints.size === 1;
      issues.push({
        id: `${exact ? 'duplicate' : 'conflict'}:${schema.identityKey}:${identity}:${rowIds.join(',')}`,
        type: exact ? 'EXACT_DUPLICATE' : 'CONFLICTING_IDENTITY',
        rowIds,
        field: schema.identityKey,
        value: group[0]?.values[schema.identityKey] ?? null,
      });
    }
  }

  return issues;
}

export function allowedResolutionStrategies(issue: DataIssue): DataResolutionStrategy[] {
  if (issue.type === 'EXACT_DUPLICATE') return ['REMOVE_DUPLICATE'];
  if (issue.type === 'MISSING_REQUIRED' || issue.type === 'INVALID_CATEGORY') {
    return ['EXCLUDE_UNCERTAIN_VALUE'];
  }
  return ['FLAG_FOR_REVIEW'];
}

export function resolveDataSet(
  schema: DataTableSchema,
  rows: DataRow[],
  resolutions: DataResolution[],
): ResolvedDataSet {
  const issues = inspectDataSet(schema, rows);
  const issueById = new Map(issues.map((issue) => [issue.id, issue]));
  const removedRowIds = new Set<string>();
  const excludedCells = new Set<string>();
  const resolvedIssueIds = new Set<string>();
  const resolutionLog: ResolutionLogEntry[] = [];

  for (const resolution of resolutions) {
    const issue = issueById.get(resolution.issueId);
    const allowed = issue ? allowedResolutionStrategies(issue) : [];
    const applied = Boolean(issue && allowed.includes(resolution.strategy));
    resolutionLog.push({ ...resolution, applied });
    if (!issue || !applied) continue;

    if (resolution.strategy === 'REMOVE_DUPLICATE') {
      for (const rowId of issue.rowIds.slice(1)) removedRowIds.add(rowId);
    } else if (resolution.strategy === 'EXCLUDE_UNCERTAIN_VALUE' && issue.field) {
      for (const rowId of issue.rowIds) excludedCells.add(cellKey(rowId, issue.field));
    }

    resolvedIssueIds.add(issue.id);
  }

  return {
    rows: rows.filter((row) => !removedRowIds.has(row.id)),
    issues,
    unresolvedIssueIds: issues.filter((issue) => !resolvedIssueIds.has(issue.id)).map((issue) => issue.id),
    excludedCells: [...excludedCells],
    removedRowIds: [...removedRowIds],
    resolutionLog,
  };
}

function categoryColumn(schema: DataTableSchema, field: string): DataColumnSchema {
  const column = schema.columns.find((candidate) => candidate.key === field);
  if (!column || column.type !== 'CATEGORY') {
    throw new Error(`Field ${field} is not a category column.`);
  }
  return column;
}

export function summarizeCategory(
  schema: DataTableSchema,
  rows: DataRow[],
  field: string,
  excludedCells: string[] = [],
): CategorySummary {
  const column = categoryColumn(schema, field);
  const excluded = new Set(excludedCells);
  const counts: Record<string, number> = {};

  for (const row of rows) {
    if (excluded.has(cellKey(row.id, field))) continue;
    const value = row.values[field];
    if (isMissing(value)) continue;
    const normalized = String(value);
    if (column.allowedValues && !column.allowedValues.includes(normalized)) continue;
    counts[normalized] = (counts[normalized] ?? 0) + 1;
  }

  return {
    field,
    sampleSize: Object.values(counts).reduce((total, count) => total + count, 0),
    counts,
  };
}

export function evaluateCategoryClaim(
  schema: DataTableSchema,
  data: ResolvedDataSet,
  claim: CategoryClaim,
): CategoryClaimEvaluation {
  categoryColumn(schema, claim.field);
  const summary = summarizeCategory(schema, data.rows, claim.field, data.excludedCells);
  const matchingCount = summary.counts[claim.value] ?? 0;
  const share = summary.sampleSize > 0 ? matchingCount / summary.sampleSize : null;
  const ready = data.unresolvedIssueIds.length === 0;

  let supported: boolean | null = null;
  if (ready && summary.sampleSize > 0) {
    if (claim.kind === 'MAJORITY') {
      supported = matchingCount > summary.sampleSize / 2;
    } else {
      const otherCounts = Object.entries(summary.counts)
        .filter(([value]) => value !== claim.value)
        .map(([, count]) => count);
      const strongestOther = otherCounts.length > 0 ? Math.max(...otherCounts) : 0;
      supported = matchingCount > strongestOther;
    }
  }

  return {
    ready,
    supported,
    sampleSize: summary.sampleSize,
    matchingCount,
    share,
    counts: summary.counts,
  };
}
