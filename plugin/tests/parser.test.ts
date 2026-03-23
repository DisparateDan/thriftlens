import { describe, it, expect } from 'vitest';
import { parseDate, parseRecordsBlock, serialiseEntry } from '../src/parser';
import type { BudgetEntry } from '../src/types';

// ── parseDate ─────────────────────────────────────────────────

describe('parseDate', () => {
  it('parses a valid date string', () => {
    const d = parseDate('2025-03-15');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2025);
    expect(d!.getMonth()).toBe(2); // 0-indexed
    expect(d!.getDate()).toBe(15);
  });

  it('returns null for empty input', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });

  it('handles numeric input (Dataview-style Luxon conversion)', () => {
    // Should not throw; will produce NaN date — just not crash
    expect(() => parseDate(12345)).not.toThrow();
  });
});

// ── parseRecordsBlock ─────────────────────────────────────────

const BLOCK = `
- date: 2025-01-01
  amount: 850
  spend_type: monthly_fixed
  spend_category: rent
  description: Monthly rent

- date: 2025-01-01
  amount: 1200
  spend_type: annual_estimate
  spend_category: insurance
  description: Home insurance

- date: 2025-03-10
  amount: 94.80
  spend_type: actual_spend
  spend_category: groceries
  description: Supermarket run

- date: 2025-06-01
  amount: 500
  spend_type: annual_estimate
  spend_category: repairs
  description: Boiler service estimate
  valid_until: 2025-12-31
`;

describe('parseRecordsBlock', () => {
  const records = parseRecordsBlock(BLOCK);

  it('parses all four records', () => {
    expect(records).toHaveLength(4);
  });

  it('parses a monthly_fixed record correctly', () => {
    const r = records[0];
    expect(r.spend_type).toBe('monthly_fixed');
    expect(r.amount).toBe(850);
    expect(r.spend_category).toBe('rent');
    expect(r.valid_until).toBeNull();
  });

  it('parses an annual_estimate correctly', () => {
    const r = records[1];
    expect(r.spend_type).toBe('annual_estimate');
    expect(r.amount).toBe(1200);
    expect(r.spend_category).toBe('insurance');
  });

  it('parses an actual_spend correctly', () => {
    const r = records[2];
    expect(r.spend_type).toBe('actual_spend');
    expect(r.amount).toBe(94.80);
    expect(r.date.getMonth()).toBe(2); // March
  });

  it('parses valid_until when present', () => {
    const r = records[3];
    expect(r.valid_until).not.toBeNull();
    expect(r.valid_until!.getFullYear()).toBe(2025);
    expect(r.valid_until!.getMonth()).toBe(11); // December
  });

  it('returns empty array for empty input', () => {
    expect(parseRecordsBlock('')).toHaveLength(0);
  });
});

// ── serialiseEntry + roundtrip ────────────────────────────────

describe('serialiseEntry', () => {
  const entry: BudgetEntry = {
    date:           new Date(2025, 2, 15),
    amount:         94.80,
    spend_type:     'actual_spend',
    spend_category: 'groceries',
    description:    'Supermarket run',
    valid_until:    null,
  };

  it('produces parseable output (roundtrip)', () => {
    const yaml   = serialiseEntry(entry);
    const parsed = parseRecordsBlock(yaml);
    expect(parsed).toHaveLength(1);
    const r = parsed[0];
    expect(r.amount).toBe(94.80);
    expect(r.spend_category).toBe('groceries');
    expect(r.spend_type).toBe('actual_spend');
    expect(r.date.getFullYear()).toBe(2025);
    expect(r.date.getMonth()).toBe(2);
    expect(r.date.getDate()).toBe(15);
  });

  it('omits valid_until when null', () => {
    expect(serialiseEntry(entry)).not.toContain('valid_until');
  });

  it('includes valid_until when set', () => {
    const withExpiry = { ...entry, valid_until: new Date(2025, 5, 30) };
    expect(serialiseEntry(withExpiry)).toContain('valid_until: 2025-06-30');
  });

  it('formats integer amounts without decimal places', () => {
    const intEntry = { ...entry, amount: 850 };
    expect(serialiseEntry(intEntry)).toContain('amount: 850\n');
  });

  it('formats decimal amounts to 2dp', () => {
    expect(serialiseEntry(entry)).toContain('amount: 94.80\n');
  });
});
