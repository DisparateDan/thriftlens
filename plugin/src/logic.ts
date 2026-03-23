import type { BudgetEntry } from './types';

export const MONTH_NAMES = [
  'January', 'February', 'March',     'April',   'May',      'June',
  'July',    'August',   'September', 'October', 'November', 'December',
];

// Number of months a monthly_fixed record is active within a given year.
export function monthsActiveInYear(record: BudgetEntry, year: number): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd   = new Date(year, 11, 31);
  if (record.date > yearEnd) return 0;
  if (record.valid_until && record.valid_until < yearStart) return 0;
  const start = record.date > yearStart ? record.date : yearStart;
  const end   = record.valid_until && record.valid_until < yearEnd ? record.valid_until : yearEnd;
  return end.getMonth() - start.getMonth() + 1;
}

// Annualised value of a planned record.
export function annualValue(record: BudgetEntry, year: number): number {
  if (record.spend_type === 'annual_budget') {
    const yearStart = new Date(year, 0, 1);
    const yearEnd   = new Date(year, 11, 31);
    if (record.date > yearEnd) return 0;
    if (record.valid_until && record.valid_until < yearStart) return 0;
    return record.amount;
  }
  // monthly_fixed
  return record.amount * monthsActiveInYear(record, year);
}

// Monthly value of a planned record for a given year+month (0-indexed).
export function monthlyValue(record: BudgetEntry, year: number, month: number): number {
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0);
  if (record.date > monthEnd) return 0;
  if (record.valid_until && record.valid_until < monthStart) return 0;
  return record.spend_type === 'annual_budget' ? record.amount / 12 : record.amount;
}

// Months a monthly_fixed record has been active up to and including the current month.
export function monthsToDate(record: BudgetEntry, year: number): number {
  const now      = new Date();
  const nowYear  = now.getFullYear();
  const nowMonth = now.getMonth();
  if (year > nowYear) return 0;
  const effectiveEnd = year < nowYear ? 11 : nowMonth;
  const yearStart    = new Date(year, 0, 1);
  const yearEnd      = new Date(year, effectiveEnd, 1);
  if (record.date > yearEnd) return 0;
  if (record.valid_until && record.valid_until < yearStart) return 0;
  const start = record.date > yearStart ? record.date : yearStart;
  const end   = record.valid_until && record.valid_until < yearEnd ? record.valid_until : yearEnd;
  return end.getMonth() - start.getMonth() + 1;
}

// Actual spend records falling within a given year+month (0-indexed).
export function spendInMonth(records: BudgetEntry[], year: number, month: number): BudgetEntry[] {
  return records.filter(r =>
    r.spend_type === 'actual_spend' &&
    r.date.getFullYear() === year &&
    r.date.getMonth() === month
  );
}

export function fmt(n: number, currencySymbol: string): string {
  return currencySymbol + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function fmtCat(s: string): string {
  return (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
