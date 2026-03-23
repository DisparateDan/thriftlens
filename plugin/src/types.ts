export interface BudgetEntry {
  date:           Date;
  amount:         number;
  spend_type:     'monthly_fixed' | 'annual_estimate' | 'actual_spend' | 'exceptional';
  description:    string;
  spend_category: string;
  valid_until:    Date | null;
}
