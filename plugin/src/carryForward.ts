import type { BudgetEntry } from './types';

export interface ProposedEntry extends BudgetEntry {
  origin:        string;
  discretionary: boolean;
}

/**
 * Pure function — no Obsidian dependencies.
 * Builds the carry-forward proposal from sourceRecords.
 */
export function buildProposal(
  sourceRecords: BudgetEntry[],
  sourceYear:    number,
  targetYear:    number,
): ProposedEntry[] {
  const actualsByCat: Record<string, number> = {};
  sourceRecords
    .filter(r => r.spend_type === 'actual_spend')
    .forEach(r => {
      actualsByCat[r.spend_category] = (actualsByCat[r.spend_category] || 0) + r.amount;
    });

  const jan1 = new Date(targetYear, 0, 1);
  const proposed: ProposedEntry[] = [];

  for (const r of sourceRecords) {
    if (r.spend_type === 'planned_known' && r.periodicity === 'monthly') {
      proposed.push({
        ...r, date: jan1, valid_until: null,
        origin:        `carried from ${sourceYear}`,
        discretionary: false,
      });

    } else if (r.spend_type === 'planned_known' && r.periodicity === 'annual') {
      const hasActuals = r.spend_category in actualsByCat;
      proposed.push({
        ...r, date: jan1, valid_until: null,
        amount: hasActuals ? actualsByCat[r.spend_category] : r.amount,
        origin: hasActuals
          ? `seeded from ${sourceYear} actuals`
          : `carried from ${sourceYear} (no actuals found)`,
        discretionary: false,
      });

    } else if (r.spend_type === 'planned_estimate') {
      proposed.push({
        ...r, date: jan1, valid_until: null,
        origin:        `discretionary — review before keeping`,
        discretionary: true,
      });
    }
    // actual_spend records are not carried forward
  }

  return proposed;
}
