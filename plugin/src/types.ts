export interface BudgetEntry {
  date:           Date;
  amount:         number;
  spend_type:     'planned_known' | 'planned_estimate' | 'actual_spend';
  periodicity:    'monthly' | 'annual';
  description:    string;
  spend_category: string;
  valid_until:    Date | null;
}
