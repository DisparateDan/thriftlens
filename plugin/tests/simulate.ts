/**
 * Carry-forward simulation — deterministic multi-year report.
 *
 * Defines a fixed household profile, runs buildProposal across N years,
 * applies controlled actuals each year, and prints a legible year-by-year
 * report you can read to verify carry-forward matches your mental model.
 *
 * Usage (from plugin/):
 *   ./run-simulate.sh [--years 5] [--start 2022]
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildProposal } from '../src/carryForward';
import type { BudgetEntry } from '../src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Args ──────────────────────────────────────────────────────

const args       = process.argv.slice(2);
const numYears   = parseInt(args.find(a => a.startsWith('--years='))?.split('=')[1]  ?? '5', 10);
const startYear  = parseInt(args.find(a => a.startsWith('--start='))?.split('=')[1] ?? '2022', 10);

// ── Household profile ─────────────────────────────────────────
// Fixed planned amounts for year 0. Actuals are deterministic: planned × multiplier.
// Multipliers > 1 = overspend, < 1 = underspend.

interface AnnualCost {
  category:    string;
  description: string;
  planned:     number;
  // Actual each year = planned × multiplier[yearIndex % multipliers.length]
  // This gives a predictable but varied pattern across years.
  multipliers: number[];
}

interface MonthlyCost {
  category:    string;
  description: string;
  amount:      number;
}

interface Estimate {
  category:    string;
  description: string;
  amount:      number;
}

const MONTHLY: MonthlyCost[] = [
  { category: 'rent',      description: 'Monthly rent',      amount: 1200 },
  { category: 'phone',     description: 'Mobile phone plan', amount:   45 },
  { category: 'broadband', description: 'Broadband',         amount:   35 },
];

const ANNUAL: AnnualCost[] = [
  {
    category:    'home_insurance',
    description: 'Home insurance premium',
    planned:     800,
    multipliers: [1.05, 1.08, 0.97, 1.12, 1.03],  // shopped around in year 3
  },
  {
    category:    'car_insurance',
    description: 'Car insurance premium',
    planned:     600,
    multipliers: [1.10, 1.15, 1.20, 0.88, 0.92],  // switched provider year 4
  },
  {
    category:    'property_tax',
    description: 'Annual property tax',
    planned:     1400,
    multipliers: [1.00, 1.02, 1.02, 1.03, 1.03],  // steady rise
  },
  {
    category:    'heating_oil',
    description: 'Heating oil',
    planned:     900,
    multipliers: [1.22, 0.95, 1.08, 1.31, 0.89],  // volatile
  },
];

const ESTIMATES: Estimate[] = [
  { category: 'holiday', description: 'Holiday budget', amount: 2000 },
];

// ── Helpers ───────────────────────────────────────────────────

function d(year: number, month = 0, day = 1): Date {
  return new Date(year, month, day);
}

function pct(n: number): string {
  return (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%';
}

function money(n: number): string {
  return '£' + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function pad(s: string, n: number): string {
  return s.padEnd(n);
}

function row(...cols: string[]): string {
  return '  ' + cols.join('  ');
}

function hr(char = '─', len = 72): string {
  return char.repeat(len);
}

// ── Simulation ────────────────────────────────────────────────

function buildYearRecords(
  year:       number,
  yearIndex:  number,
  proposed:   BudgetEntry[],      // planned records from carry-forward (or seed for year 0)
): { records: BudgetEntry[]; actualsMap: Map<string, number> } {
  const records: BudgetEntry[] = [...proposed];
  const actualsMap = new Map<string, number>();

  for (const cost of ANNUAL) {
    const mult   = cost.multipliers[yearIndex % cost.multipliers.length];
    // Base the actual on what was proposed (seeded from prior actuals), not the original planned.
    const planned = proposed.find(r => r.spend_category === cost.category)?.amount ?? cost.planned;
    const actual  = Math.round(planned * mult * 100) / 100;
    actualsMap.set(cost.category, actual);
    records.push({
      date:           d(year, 3, 15), // April — representative payment date
      amount:         actual,
      spend_type:     'actual_spend',
      periodicity:    'annual',
      spend_category: cost.category,
      description:    `${cost.description} — paid`,
      valid_until:    null,
    });
  }

  return { records, actualsMap };
}

function seedYear0(year: number): BudgetEntry[] {
  const records: BudgetEntry[] = [];
  for (const m of MONTHLY) {
    records.push({
      date: d(year), amount: m.amount, spend_type: 'planned_known',
      periodicity: 'monthly', spend_category: m.category,
      description: m.description, valid_until: null,
    });
  }
  for (const a of ANNUAL) {
    records.push({
      date: d(year), amount: a.planned, spend_type: 'planned_known',
      periodicity: 'annual', spend_category: a.category,
      description: a.description, valid_until: null,
    });
  }
  for (const e of ESTIMATES) {
    records.push({
      date: d(year), amount: e.amount, spend_type: 'planned_estimate',
      periodicity: 'annual', spend_category: e.category,
      description: e.description, valid_until: null,
    });
  }
  return records;
}

// ── Report ────────────────────────────────────────────────────

function printYearReport(
  year:       number,
  planned:    BudgetEntry[],
  actualsMap: Map<string, number>,
  nextYear:   number,
  proposal:   ReturnType<typeof buildProposal>,
): void {
  emit('\n' + hr('═'));
  emit(`  YEAR ${year}`);
  emit(hr('═'));

  // Monthly fixed (unchanged each year)
  emit('\n  Monthly fixed costs:');
  emit(hr('─', 50));
  for (const r of planned.filter(r => r.periodicity === 'monthly' && r.spend_type !== 'actual_spend')) {
    emit(row(
      pad(r.description, 28),
      pad(money(r.amount) + '/mo', 12),
      money(r.amount * 12) + '/yr',
    ));
  }

  // Annual planned vs actual
  emit('\n  Annual commitments — planned vs actual:');
  emit(hr('─', 50));
  emit(row(
    pad('Category', 22),
    pad('Planned', 12),
    pad('Actual', 12),
    'Variance',
  ));
  emit(hr('─', 50));
  for (const r of planned.filter(r => r.periodicity === 'annual' && r.spend_type === 'planned_known')) {
    const actual  = actualsMap.get(r.spend_category);
    const variance = actual != null ? (actual - r.amount) / r.amount : null;
    emit(row(
      pad(r.description, 22),
      pad(money(r.amount), 12),
      actual != null ? pad(money(actual), 12) : pad('—', 12),
      variance != null ? pct(variance) : '',
    ));
  }

  // Estimates
  const estimates = planned.filter(r => r.spend_type === 'planned_estimate');
  if (estimates.length > 0) {
    emit('\n  Estimates (discretionary):');
    emit(hr('─', 50));
    for (const r of estimates) {
      emit(row(pad(r.description, 28), money(r.amount)));
    }
  }

  // Carry-forward proposal
  emit(`\n  Carry-forward proposal → ${nextYear}:`);
  emit(hr('─', 50));
  for (const p of proposal) {
    const isSeedChange = p.spend_type === 'planned_known' && p.periodicity === 'annual';
    const prior = planned.find(r => r.spend_category === p.spend_category && r.spend_type === 'planned_known');
    const change = isSeedChange && prior && prior.amount !== p.amount
      ? `  ← was ${money(prior.amount)}, ${pct((p.amount - prior.amount) / prior.amount)}`
      : '';
    const tag = p.discretionary ? '  [discretionary]' : '';
    emit(row(
      pad(p.description, 28),
      pad(money(p.amount), 12),
      `[${p.origin}]${tag}${change}`,
    ));
  }
}

// ── Output (stdout + file) ────────────────────────────────────

const outFile = path.resolve(__dirname, '../simulation.txt');
const stream  = fs.createWriteStream(outFile, { encoding: 'utf8' });

function emit(line = ''): void {
  process.stdout.write(line + '\n');
  stream.write(line + '\n');
}

// Patch all console.log calls in report functions to use emit
// (done by replacing console.log below in main and printYearReport)

// ── Main ──────────────────────────────────────────────────────

emit('\nThriftLens — Carry-Forward Simulation');
emit(`Profile: ${MONTHLY.length} monthly, ${ANNUAL.length} annual, ${ESTIMATES.length} estimate(s)`);
emit(`Simulating ${numYears} years from ${startYear} to ${startYear + numYears - 1}`);

let currentRecords = seedYear0(startYear);

for (let i = 0; i < numYears; i++) {
  const year     = startYear + i;
  const nextYear = year + 1;

  const { records: fullRecords, actualsMap } = buildYearRecords(year, i, currentRecords);
  const proposal = buildProposal(fullRecords, year, nextYear);

  printYearReport(year, currentRecords, actualsMap, nextYear, proposal);

  // Next year's planned records = this year's proposal (strip ProposedEntry extras)
  currentRecords = proposal.map(({ origin: _o, discretionary: _d, ...rest }) => rest);
}

emit('\n' + hr('═'));
emit('  Simulation complete.');
emit(hr('═') + '\n');

stream.end(() => {
  process.stderr.write(`Transcript written to simulation.txt\n`);
});
