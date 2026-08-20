import { describe, expect, it } from 'vitest';
import {
  INFORMATION_SYSTEM_PIPELINE,
  inspectIdentityConsistency,
  isInformationSystemPipelineValid,
  queryTable,
  samePredicateSet,
  updateTableCell,
  validateTable,
  validateTableAgainstEvidence,
  type TableColumn,
  type TableEvidenceAssertion,
  type TablePredicate,
  type TableRow,
} from './data-table-engine';

const columns: TableColumn[] = [
  { key: 'code', label: 'ID záznamu', type: 'TEXT', required: true, unique: true },
  { key: 'borrower', label: 'Čtenář', type: 'TEXT', required: true },
  { key: 'daysBorrowed', label: 'Dní vypůjčeno', type: 'NUMBER', required: true, min: 0, max: 30 },
  { key: 'returned', label: 'Vráceno', type: 'BOOLEAN', required: true },
];

const dirtyRows: TableRow[] = [
  { id: 'r1', values: { code: 'A-101', borrower: 'Anna', daysBorrowed: 5, returned: false } },
  { id: 'r2', values: { code: 'A-102', borrower: 'Matěj', daysBorrowed: 18, returned: false } },
  { id: 'r3', values: { code: 'A-102', borrower: 'Ema', daysBorrowed: 9, returned: true } },
  { id: 'r4', values: { code: 'A-104', borrower: 'Jonáš', daysBorrowed: 42, returned: false } },
  { id: 'r5', values: { code: 'A-105', borrower: '', daysBorrowed: 3, returned: false } },
];

const evidenceAssertions: TableEvidenceAssertion[] = [
  { rowId: 'r3', columnKey: 'code', expectedValue: 'A-103' },
  { rowId: 'r4', columnKey: 'daysBorrowed', expectedValue: 12 },
  { rowId: 'r5', columnKey: 'borrower', expectedValue: 'Klára' },
];

const reminderRule: TablePredicate[] = [
  { columnKey: 'returned', operator: 'EQ', value: false },
  { columnKey: 'daysBorrowed', operator: 'GTE', value: 14 },
];

function cleanRows(): TableRow[] {
  let rows = updateTableCell(dirtyRows, 'r3', 'code', 'A-103');
  rows = updateTableCell(rows, 'r4', 'daysBorrowed', 12);
  return updateTableCell(rows, 'r5', 'borrower', 'Klára');
}

describe('data table engine', () => {
  it('finds only the actionable dirty-data cells', () => {
    expect(validateTable(dirtyRows, columns)).toEqual([
      expect.objectContaining({ rowId: 'r3', columnKey: 'code', kind: 'DUPLICATE' }),
      expect.objectContaining({ rowId: 'r4', columnKey: 'daysBorrowed', kind: 'OUT_OF_RANGE' }),
      expect.objectContaining({ rowId: 'r5', columnKey: 'borrower', kind: 'MISSING_REQUIRED' }),
    ]);
  });

  it('keeps source-backed cells unresolved when a learner invents schema-valid replacements', () => {
    let rows = updateTableCell(dirtyRows, 'r3', 'code', 'A-999');
    rows = updateTableCell(rows, 'r4', 'daysBorrowed', 10);
    rows = updateTableCell(rows, 'r5', 'borrower', 'Eva');

    expect(validateTable(rows, columns)).toEqual([]);
    expect(validateTableAgainstEvidence(rows, columns, evidenceAssertions)).toEqual([
      expect.objectContaining({ rowId: 'r3', columnKey: 'code', kind: 'EVIDENCE_MISMATCH' }),
      expect.objectContaining({ rowId: 'r4', columnKey: 'daysBorrowed', kind: 'EVIDENCE_MISMATCH' }),
      expect.objectContaining({ rowId: 'r5', columnKey: 'borrower', kind: 'EVIDENCE_MISMATCH' }),
    ]);
  });

  it('becomes clean only after the three evidence-backed corrections', () => {
    expect(validateTableAgainstEvidence(cleanRows(), columns, evidenceAssertions)).toEqual([]);
  });

  it('distinguishes an exact duplicate from conflicting records sharing one identity', () => {
    const exactRows: TableRow[] = [
      { id: 'a', values: { code: 'X-1', borrower: 'Ada', daysBorrowed: 4, returned: false } },
      { id: 'b', values: { code: 'X-1', borrower: 'Ada', daysBorrowed: 4, returned: false } },
    ];
    const conflictingRows: TableRow[] = [
      { id: 'a', values: { code: 'X-1', borrower: 'Ada', daysBorrowed: 4, returned: false } },
      { id: 'b', values: { code: 'X-1', borrower: 'Ben', daysBorrowed: 9, returned: true } },
    ];

    expect(inspectIdentityConsistency(exactRows, columns, 'code')).toEqual([
      expect.objectContaining({ kind: 'EXACT_DUPLICATE', rowIds: ['a', 'b'] }),
    ]);
    expect(inspectIdentityConsistency(conflictingRows, columns, 'code')).toEqual([
      expect.objectContaining({ kind: 'CONFLICTING_IDENTITY', rowIds: ['a', 'b'] }),
    ]);
  });

  it('derives information from corrected records instead of hard-coded UI answers', () => {
    const overdue = queryTable(cleanRows(), reminderRule);
    expect(overdue.map((row) => row.values.borrower)).toEqual(['Matěj']);
  });

  it('compares learner-built query semantics independent of predicate order', () => {
    const reordered: TablePredicate[] = [reminderRule[1]!, reminderRule[0]!];
    expect(samePredicateSet(reordered, reminderRule)).toBe(true);
    expect(samePredicateSet([
      { columnKey: 'returned', operator: 'EQ', value: false },
      { columnKey: 'daysBorrowed', operator: 'GTE', value: 7 },
    ], reminderRule)).toBe(false);
  });

  it('requires the information-system pipeline to preserve input → validation → storage → query → output', () => {
    expect(isInformationSystemPipelineValid(INFORMATION_SYSTEM_PIPELINE)).toBe(true);
    expect(isInformationSystemPipelineValid(['INPUT', 'STORE', 'VALIDATE', 'QUERY', 'OUTPUT'])).toBe(false);
    expect(isInformationSystemPipelineValid(['INPUT', 'VALIDATE', 'STORE', 'QUERY', 'SHARE_PASSWORD'])).toBe(false);
  });

  it('reuses the same reminder rule on a changed transfer dataset', () => {
    const transferRows: TableRow[] = [
      { id: 't1', values: { code: 'B-201', borrower: 'Tereza', daysBorrowed: 16, returned: false } },
      { id: 't2', values: { code: 'B-202', borrower: 'David', daysBorrowed: 22, returned: true } },
      { id: 't3', values: { code: 'B-203', borrower: 'Nina', daysBorrowed: 8, returned: false } },
    ];

    expect(queryTable(transferRows, reminderRule).map((row) => row.values.borrower)).toEqual(['Tereza']);
  });
});