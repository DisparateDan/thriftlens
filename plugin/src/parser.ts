import type { BudgetEntry } from './types';

export function parseDate(str: unknown): Date | null {
  if (!str || !String(str).trim()) return null;
  const [y, m, d] = String(str).trim().split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function parseRecordsBlock(text: string): BudgetEntry[] {
  const records: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (/^\s*-\s+date:/.test(line)) {
      if (current) records.push(current);
      current = {};
    }
    if (current) {
      const m = line.match(/^\s*-?\s*([\w_]+):\s*(.+)$/);
      if (m) current[m[1]] = m[2].trim();
    }
  }
  if (current) records.push(current);
  return records
    .filter(r => r.date)
    .map(r => ({
      date:           parseDate(r.date)!,
      amount:         parseFloat(r.amount) || 0,
      spend_type:     r.spend_type  as BudgetEntry['spend_type'],
      description:    r.description    || '',
      spend_category: r.spend_category || '',
      valid_until:    parseDate(r.valid_until) ?? null,
    }));
}

// ── Serialiser ────────────────────────────────────────────────────────────────

export function fmtDate(d: Date): string {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fmtAmount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// Canonical field order. date is always written; for non-actuals it will be YYYY-01-01.
export function serialiseEntry(entry: BudgetEntry): string {
  const lines = [
    `- date: ${fmtDate(entry.date)}`,
    `  amount: ${fmtAmount(entry.amount)}`,
    `  spend_type: ${entry.spend_type}`,
    `  spend_category: ${entry.spend_category}`,
    `  description: ${entry.description}`,
  ];
  if (entry.valid_until) {
    lines.push(`  valid_until: ${fmtDate(entry.valid_until)}`);
  }
  return lines.join('\n');
}
