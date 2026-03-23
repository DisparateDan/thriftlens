import type { BudgetEntry } from './types';

export interface ProposedEntry extends BudgetEntry {
  origin:        string;
  discretionary: boolean;
}

/**
 * Pure function — no Obsidian dependencies.
 * Builds the carry-forward proposal from sourceRecords.
 *
 * Rules:
 *   monthly_fixed  → clone as-is into target year
 *   annual_estimate  → seed amount from prior year actuals for the same category;
 *                    fall back to source amount if no actuals found
 *   actual_spend   → not carried forward
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
    if (r.spend_type === 'monthly_fixed') {
      proposed.push({
        ...r, date: jan1, valid_until: null,
        origin:        `carried from ${sourceYear}`,
        discretionary: false,
      });

    } else if (r.spend_type === 'annual_estimate') {
      const hasActuals = r.spend_category in actualsByCat;
      proposed.push({
        ...r, date: jan1, valid_until: null,
        amount: hasActuals ? actualsByCat[r.spend_category] : r.amount,
        origin: hasActuals
          ? `seeded from ${sourceYear} actuals`
          : `carried from ${sourceYear} (no actuals found)`,
        discretionary: false,
      });
    }
    // actual_spend and exceptional records are not carried forward
  }

  return proposed;
}
