import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseRecordsBlock } from '../src/parser';
import { annualValue, monthlyValue, spendInMonth, monthsToDate } from '../src/logic';
import { buildProposal } from '../src/carryForward';
import type { BudgetEntry } from '../src/types';

// ── Fixture loading ───────────────────────────────────────────

function loadFixture(filename: string): BudgetEntry[] {
  const filePath = join(__dirname, 'fixtures', filename);
  const raw = readFileSync(filePath, 'utf-8');
  // Extract content between ```yaml fences
  const match = raw.match(/```yaml\n([\s\S]*?)\n```/);
  if (!match) throw new Error(`No yaml block found in ${filename}`);
  return parseRecordsBlock(match[1]);
}

// ── 2024 fixture (complete past year) ────────────────────────

describe('2024 fixture (complete past year)', () => {
  afterEach(() => vi.useRealTimers());

  let records2024: BudgetEntry[];
  beforeAll(() => {
    vi.setSystemTime(new Date(2025, 5, 1)); // 2025-06-01
    records2024 = loadFixture('2024.md');
  });

  afterAll(() => vi.useRealTimers());

  it('loads all records', () => {
    expect(records2024.length).toBeGreaterThan(0);
  });

  it('total annual value of monthly_fixed = 15960', () => {
    // rent 1200×12=14400, internet 50×12=600, phone 80×12=960 → 15960
    const monthly = records2024.filter(r => r.spend_type === 'monthly_fixed');
    const total = monthly.reduce((sum, r) => sum + annualValue(r, 2024), 0);
    expect(total).toBe(15960);
  });

  it('total annual value of annual_estimates = 3200', () => {
    // heating 2400 + driving insurance 500 + driving service 300 = 3200
    const estimates = records2024.filter(r => r.spend_type === 'annual_estimate');
    const total = estimates.reduce((sum, r) => sum + annualValue(r, 2024), 0);
    expect(total).toBe(3200);
  });

  it('monthsToDate for any monthly_fixed record in 2024 = 12 (past year)', () => {
    vi.setSystemTime(new Date(2025, 5, 1));
    const monthly = records2024.filter(r => r.spend_type === 'monthly_fixed');
    monthly.forEach(r => {
      expect(monthsToDate(r, 2024)).toBe(12);
    });
  });

  it('actual spend for rent category = 14400', () => {
    const rentActuals = records2024.filter(
      r => r.spend_type === 'actual_spend' && r.spend_category === 'rent'
    );
    const total = rentActuals.reduce((sum, r) => sum + r.amount, 0);
    expect(total).toBe(14400);
  });

  it('actual spend for heating category = 2280', () => {
    const heatingActuals = records2024.filter(
      r => r.spend_type === 'actual_spend' && r.spend_category === 'heating'
    );
    const total = heatingActuals.reduce((sum, r) => sum + r.amount, 0);
    expect(total).toBe(2280);
  });

  it('actual spend for driving category = 770', () => {
    const drivingActuals = records2024.filter(
      r => r.spend_type === 'actual_spend' && r.spend_category === 'driving'
    );
    const total = drivingActuals.reduce((sum, r) => sum + r.amount, 0);
    expect(total).toBeCloseTo(770, 2);
  });
});

// ── 2024 → 2025 carry-forward ─────────────────────────────────

describe('carry-forward from 2024 to 2025', () => {
  let records2024: BudgetEntry[];
  beforeAll(() => {
    records2024 = loadFixture('2024.md');
  });

  it('rent carries at 1200 (monthly_fixed, unchanged)', () => {
    const proposal = buildProposal(records2024, 2024, 2025);
    const rentProposals = proposal.filter(p => p.spend_category === 'rent');
    expect(rentProposals).toHaveLength(1);
    expect(rentProposals[0].amount).toBe(1200);
    expect(rentProposals[0].spend_type).toBe('monthly_fixed');
    expect(rentProposals[0].date.getFullYear()).toBe(2025);
  });

  it('heating seeded at 2280 from actuals', () => {
    const proposal = buildProposal(records2024, 2024, 2025);
    const heatingProposals = proposal.filter(p => p.spend_category === 'heating');
    expect(heatingProposals).toHaveLength(1);
    expect(heatingProposals[0].amount).toBe(2280);
    expect(heatingProposals[0].origin).toContain('actuals');
  });

  it('driving seeded at 770 from actuals (combined across two estimate records)', () => {
    const proposal = buildProposal(records2024, 2024, 2025);
    const drivingProposals = proposal.filter(p => p.spend_category === 'driving');
    // Two annual_estimate records for driving; actuals total 770
    const totalAmount = drivingProposals.reduce((sum, p) => sum + p.amount, 0);
    // Each driving estimate seeded from same actuals total of 770
    expect(drivingProposals.length).toBe(2);
    drivingProposals.forEach(p => {
      expect(p.amount).toBe(770); // each seeded from full actuals total
      expect(p.origin).toContain('actuals');
    });
  });
});

// ── 2025 fixture (partial year) ───────────────────────────────

describe('2025 fixture (partial year, now = 2025-06-01)', () => {
  let records2025: BudgetEntry[];

  beforeAll(() => {
    vi.setSystemTime(new Date(2025, 5, 1)); // 2025-06-01
    records2025 = loadFixture('2025.md');
  });

  afterAll(() => vi.useRealTimers());

  it('loads all records', () => {
    expect(records2025.length).toBeGreaterThan(0);
  });

  it('monthsToDate for rent record = 6 (Jan–Jun, now = 2025-06-01)', () => {
    vi.setSystemTime(new Date(2025, 5, 1));
    const rentRecord = records2025.find(
      r => r.spend_type === 'monthly_fixed' && r.spend_category === 'rent'
    );
    expect(rentRecord).toBeDefined();
    expect(monthsToDate(rentRecord!, 2025)).toBe(6);
  });

  it('spendInMonth for January groceries = [one record, 102.40]', () => {
    const janGroceries = spendInMonth(records2025, 2025, 0).filter(
      r => r.spend_category === 'groceries'
    );
    expect(janGroceries).toHaveLength(1);
    expect(janGroceries[0].amount).toBeCloseTo(102.40, 2);
  });

  it('total actual rent paid = 3900 (3 months × 1300)', () => {
    const rentActuals = records2025.filter(
      r => r.spend_type === 'actual_spend' && r.spend_category === 'rent'
    );
    const total = rentActuals.reduce((sum, r) => sum + r.amount, 0);
    expect(total).toBe(3900);
  });
});
