import { describe, it, expect } from 'vitest';
import { buildProposal } from '../src/carryForward';
import type { BudgetEntry } from '../src/types';

function entry(overrides: Partial<BudgetEntry> & { spend_type: BudgetEntry['spend_type'] }): BudgetEntry {
  return {
    date:           new Date(2025, 0, 1),
    amount:         100,
    spend_category: 'test',
    description:    'test entry',
    valid_until:    null,
    ...overrides,
  };
}

// ── Basic carry-forward rules ─────────────────────────────────

describe('buildProposal', () => {
  it('carries monthly_fixed forward unchanged', () => {
    const records = [entry({ spend_type: 'monthly_fixed', amount: 850, spend_category: 'rent' })];
    const proposal = buildProposal(records, 2025, 2026);
    expect(proposal).toHaveLength(1);
    const p = proposal[0];
    expect(p.spend_type).toBe('monthly_fixed');
    expect(p.amount).toBe(850);
    expect(p.date.getFullYear()).toBe(2026);
    expect(p.valid_until).toBeNull();
    expect(p.discretionary).toBe(false);
    expect(p.origin).toContain('2025');
  });

  it('seeds annual_estimate from actual_spend total when actuals exist', () => {
    const records = [
      entry({ spend_type: 'annual_estimate', amount: 1000, spend_category: 'insurance' }),
      entry({ spend_type: 'actual_spend',    amount: 1050, spend_category: 'insurance' }),
      entry({ spend_type: 'actual_spend',    amount:   80, spend_category: 'insurance' }),
    ];
    const proposal = buildProposal(records, 2025, 2026);
    expect(proposal).toHaveLength(1);
    expect(proposal[0].amount).toBe(1130); // 1050 + 80
    expect(proposal[0].origin).toContain('actuals');
    expect(proposal[0].discretionary).toBe(false);
  });

  it('carries annual_estimate at original amount when no actuals exist', () => {
    const records = [
      entry({ spend_type: 'annual_estimate', amount: 1000, spend_category: 'insurance' }),
    ];
    const proposal = buildProposal(records, 2025, 2026);
    expect(proposal).toHaveLength(1);
    expect(proposal[0].amount).toBe(1000);
    expect(proposal[0].origin).toContain('no actuals');
    expect(proposal[0].discretionary).toBe(false);
  });

  it('excludes actual_spend records entirely', () => {
    const records = [
      entry({ spend_type: 'actual_spend', amount: 200, spend_category: 'groceries' }),
    ];
    const proposal = buildProposal(records, 2025, 2026);
    expect(proposal).toHaveLength(0);
  });

  it('does not carry valid_until to the new year', () => {
    const records = [
      entry({
        spend_type:     'monthly_fixed',
        valid_until:    new Date(2025, 5, 30),
        spend_category: 'old_contract',
      }),
    ];
    const proposal = buildProposal(records, 2025, 2026);
    expect(proposal[0].valid_until).toBeNull();
  });

  it('sets date to 1 Jan of target year for all entries', () => {
    const records = [
      entry({ spend_type: 'monthly_fixed',   date: new Date(2025, 3, 1), spend_category: 'rent' }),
      entry({ spend_type: 'annual_estimate', date: new Date(2025, 6, 1), spend_category: 'heating' }),
    ];
    const proposal = buildProposal(records, 2025, 2026);
    proposal.forEach(p => {
      expect(p.date.getFullYear()).toBe(2026);
      expect(p.date.getMonth()).toBe(0);
      expect(p.date.getDate()).toBe(1);
    });
  });

  it('annual_estimate with actuals for different category uses source amount', () => {
    const records = [
      entry({ spend_type: 'annual_estimate', amount: 800, spend_category: 'driving' }),
      entry({ spend_type: 'actual_spend',    amount: 900, spend_category: 'heating' }), // different category
    ];
    const proposal = buildProposal(records, 2025, 2026);
    expect(proposal).toHaveLength(1);
    expect(proposal[0].amount).toBe(800); // no actuals for 'driving'
    expect(proposal[0].origin).toContain('no actuals');
  });
});

// ── Multi-year chain ──────────────────────────────────────────

describe('multi-year carry-forward chain', () => {
  it('actuals seed the next year, which then carries forward correctly', () => {
    // Year 1: planned 1000, actuals total 1200
    const year1Records: BudgetEntry[] = [
      entry({ spend_type: 'annual_estimate', amount: 1000, spend_category: 'insurance' }),
      entry({ spend_type: 'actual_spend',    amount: 1200, spend_category: 'insurance' }),
    ];
    const year2Proposal = buildProposal(year1Records, 2025, 2026);
    expect(year2Proposal[0].amount).toBe(1200);

    // Year 2: the proposal becomes the source, with actuals of 1350
    const year2Records: BudgetEntry[] = [
      ...year2Proposal.map(({ origin: _o, discretionary: _d, ...rest }) => rest),
      entry({ spend_type: 'actual_spend', amount: 1350, spend_category: 'insurance', date: new Date(2026, 0, 1) }),
    ];
    const year3Proposal = buildProposal(year2Records, 2026, 2027);
    expect(year3Proposal[0].amount).toBe(1350);
  });

  it('propagates multiple categories independently across years', () => {
    const year1Records: BudgetEntry[] = [
      entry({ spend_type: 'annual_estimate', amount: 1000, spend_category: 'insurance' }),
      entry({ spend_type: 'monthly_fixed',   amount:  850, spend_category: 'rent' }),
      entry({ spend_type: 'actual_spend',    amount: 1100, spend_category: 'insurance' }),
    ];
    const proposal = buildProposal(year1Records, 2025, 2026);
    const insurance = proposal.find(p => p.spend_category === 'insurance')!;
    const rent      = proposal.find(p => p.spend_category === 'rent')!;

    expect(insurance.amount).toBe(1100); // seeded from actuals
    expect(rent.amount).toBe(850);       // unchanged monthly
  });
});
