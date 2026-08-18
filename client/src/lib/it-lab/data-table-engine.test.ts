import { describe, expect, it } from 'vitest';
import {
  queryTable,
  updateTableCell,
  validateTable,
  type TableColumn,
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

  it('becomes clean after the three evidence-backed corrections', () => {
    expect(validateTable(cleanRows(), columns)).toEqual([]);
  });

  it('derives information from corrected records instead of hard-coded UI answers', () => {
    const overdue = queryTable(cleanRows(), [
      { columnKey: 'returned', operator: 'EQ', value: false },
      { columnKey: 'daysBorrowed', operator: 'GTE', value: 14 },
    ]);

    expect(overdue.map((row) => row.values.borrower)).toEqual(['Matěj']);
  });
});
