import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  monthsActiveInYear, annualValue, monthlyValue,
  monthsToDate, spendInMonth, fmt, fmtCat,
} from '../src/logic';
import type { BudgetEntry } from '../src/types';

// ── Helpers ───────────────────────────────────────────────────

function entry(overrides: Partial<BudgetEntry> & { spend_type: BudgetEntry['spend_type'] }): BudgetEntry {
  return {
    date:           new Date(2025, 0, 1),
    amount:         100,
    spend_category: 'test',
    description:    'test',
    valid_until:    null,
    ...overrides,
  };
}

// ── monthsActiveInYear ────────────────────────────────────────

describe('monthsActiveInYear', () => {
  it('full year monthly_fixed record → 12', () => {
    const r = entry({ spend_type: 'monthly_fixed', date: new Date(2025, 0, 1) });
    expect(monthsActiveInYear(r, 2025)).toBe(12);
  });

  it('record starting mid-year → remaining months', () => {
    const r = entry({ spend_type: 'monthly_fixed', date: new Date(2025, 6, 1) }); // July
    expect(monthsActiveInYear(r, 2025)).toBe(6); // Jul–Dec
  });

  it('record expiring mid-year → active months only', () => {
    const r = entry({
      spend_type:  'monthly_fixed',
      date:        new Date(2025, 0, 1),
      valid_until: new Date(2025, 5, 30), // June
    });
    expect(monthsActiveInYear(r, 2025)).toBe(6); // Jan–Jun
  });

  it('record that has not started yet → 0', () => {
    const r = entry({ spend_type: 'monthly_fixed', date: new Date(2026, 0, 1) });
    expect(monthsActiveInYear(r, 2025)).toBe(0);
  });

  it('record expired before year starts → 0', () => {
    const r = entry({
      spend_type:  'monthly_fixed',
      date:        new Date(2024, 0, 1),
      valid_until: new Date(2024, 11, 31),
    });
    expect(monthsActiveInYear(r, 2025)).toBe(0);
  });
});

// ── annualValue ───────────────────────────────────────────────

describe('annualValue', () => {
  it('monthly_fixed record → amount × months active', () => {
    const r = entry({ spend_type: 'monthly_fixed', amount: 100 });
    expect(annualValue(r, 2025)).toBe(1200);
  });

  it('annual_estimate record → amount as-is', () => {
    const r = entry({ spend_type: 'annual_estimate', amount: 1200 });
    expect(annualValue(r, 2025)).toBe(1200);
  });

  it('annual_estimate record not yet started → 0', () => {
    const r = entry({ spend_type: 'annual_estimate', date: new Date(2026, 0, 1) });
    expect(annualValue(r, 2025)).toBe(0);
  });

  it('annual_estimate record expired before year → 0', () => {
    const r = entry({
      spend_type:  'annual_estimate',
      date:        new Date(2024, 0, 1),
      valid_until: new Date(2024, 11, 31),
    });
    expect(annualValue(r, 2025)).toBe(0);
  });
});

// ── monthlyValue ──────────────────────────────────────────────

describe('monthlyValue', () => {
  it('monthly_fixed record → full amount', () => {
    const r = entry({ spend_type: 'monthly_fixed', amount: 850 });
    expect(monthlyValue(r, 2025, 0)).toBe(850);
  });

  it('annual_estimate record → amount / 12', () => {
    const r = entry({ spend_type: 'annual_estimate', amount: 1200 });
    expect(monthlyValue(r, 2025, 0)).toBe(100);
  });

  it('record not yet active in month → 0', () => {
    const r = entry({ spend_type: 'monthly_fixed', date: new Date(2025, 6, 1) });
    expect(monthlyValue(r, 2025, 5)).toBe(0); // June, record starts July
  });

  it('record expired before month → 0', () => {
    const r = entry({
      spend_type:  'monthly_fixed',
      date:        new Date(2025, 0, 1),
      valid_until: new Date(2025, 2, 31), // expires March
    });
    expect(monthlyValue(r, 2025, 3)).toBe(0); // April
  });
});

// ── monthsToDate ──────────────────────────────────────────────

describe('monthsToDate', () => {
  afterEach(() => vi.useRealTimers());

  it('past year → 12 months', () => {
    vi.setSystemTime(new Date(2026, 3, 1)); // April 2026
    const r = entry({ spend_type: 'monthly_fixed' });
    expect(monthsToDate(r, 2025)).toBe(12);
  });

  it('current year → months up to now', () => {
    vi.setSystemTime(new Date(2025, 5, 15)); // June 2025
    const r = entry({ spend_type: 'monthly_fixed', date: new Date(2025, 0, 1) });
    expect(monthsToDate(r, 2025)).toBe(6); // Jan–Jun
  });

  it('future year → 0', () => {
    vi.setSystemTime(new Date(2025, 0, 1));
    const r = entry({ spend_type: 'monthly_fixed' });
    expect(monthsToDate(r, 2026)).toBe(0);
  });
});

// ── spendInMonth ──────────────────────────────────────────────

describe('spendInMonth', () => {
  const records: BudgetEntry[] = [
    entry({ spend_type: 'actual_spend', date: new Date(2025, 2, 5),  amount: 50  }),
    entry({ spend_type: 'actual_spend', date: new Date(2025, 2, 20), amount: 30  }),
    entry({ spend_type: 'actual_spend', date: new Date(2025, 3, 1),  amount: 100 }),
    entry({ spend_type: 'monthly_fixed', date: new Date(2025, 2, 1), amount: 850 }),
  ];

  it('returns only actual_spend in the given month', () => {
    const march = spendInMonth(records, 2025, 2);
    expect(march).toHaveLength(2);
    expect(march.every(r => r.spend_type === 'actual_spend')).toBe(true);
  });

  it('excludes other months', () => {
    const april = spendInMonth(records, 2025, 3);
    expect(april).toHaveLength(1);
    expect(april[0].amount).toBe(100);
  });
});

// ── fmt / fmtCat ─────────────────────────────────────────────

describe('fmt', () => {
  it('formats with currency symbol', () => {
    expect(fmt(1234.5, '€')).toBe('€1,234.50');
  });

  it('handles zero', () => {
    expect(fmt(0, '£')).toBe('£0.00');
  });

  it('uses absolute value (no negative sign)', () => {
    expect(fmt(-99.99, '$')).toBe('$99.99');
  });
});

describe('fmtCat', () => {
  it('replaces underscores with spaces and capitalises', () => {
    expect(fmtCat('heating_oil')).toBe('Heating Oil');
  });

  it('handles single word', () => {
    expect(fmtCat('rent')).toBe('Rent');
  });

  it('handles empty string', () => {
    expect(fmtCat('')).toBe('');
  });
});
