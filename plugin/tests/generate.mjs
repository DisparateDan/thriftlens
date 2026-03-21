/**
 * Synthetic data generator — writes multi-year budget register files.
 *
 * Usage:
 *   node tests/generate.mjs [--years 2023-2025] [--out ../vault/budget]
 *
 * Defaults: 3 years ending in current year, written to ../vault/budget/
 * These files are safe to use as test fixtures — do not commit real data.
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────

const args       = process.argv.slice(2);
const yearsArg   = args.find(a => a.startsWith('--years'))?.split('=')[1];
const outArg     = args.find(a => a.startsWith('--out'))?.split('=')[1];

const currentYear = new Date().getFullYear();
const [startYear, endYear] = yearsArg
  ? yearsArg.split('-').map(Number)
  : [currentYear - 2, currentYear];

const outDir = path.resolve(__dirname, outArg ?? '../../vault/budget');

// ── Household profile ─────────────────────────────────────────
// Planned costs that repeat year to year, with realistic variance.

const MONTHLY_FIXED = [
  { category: 'rent',       description: 'Monthly rent',         amount: 1200  },
  { category: 'phone',      description: 'Mobile phone plan',    amount:   45  },
  { category: 'broadband',  description: 'Broadband',            amount:   35  },
  { category: 'streaming',  description: 'Streaming services',   amount:   25  },
];

const ANNUAL_COSTS = [
  { category: 'home_insurance',  description: 'Home insurance premium',  base: 800  },
  { category: 'car_insurance',   description: 'Car insurance premium',   base: 600  },
  { category: 'property_tax',    description: 'Annual property tax',     base: 1400 },
  { category: 'heating_oil',     description: 'Heating oil',             base: 900  },
  { category: 'car_service',     description: 'Annual car service',      base: 350  },
];

// Unplanned categories — appear as actual_spend only
const UNPLANNED = [
  { category: 'groceries',  description: 'Supermarket',       monthlyAvg: 300, transactions: 4 },
  { category: 'dining',     description: 'Restaurant / cafe', monthlyAvg:  80, transactions: 3 },
  { category: 'clothing',   description: 'Clothing',          monthlyAvg:  60, transactions: 2 },
];

// ── Helpers ───────────────────────────────────────────────────

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtAmount(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function jitter(base, pct = 0.08) {
  // Random variance ±pct% around base
  return Math.round(base * (1 + (Math.random() * 2 - 1) * pct) * 100) / 100;
}

function randomDayInMonth(year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.ceil(Math.random() * days));
}

function entry(fields) {
  const lines = [
    `- date: ${fmtDate(fields.date)}`,
    `  amount: ${fmtAmount(fields.amount)}`,
    `  spend_type: ${fields.spend_type}`,
    `  periodicity: ${fields.periodicity}`,
    `  spend_category: ${fields.spend_category}`,
    `  description: ${fields.description}`,
  ];
  if (fields.valid_until) lines.push(`  valid_until: ${fmtDate(fields.valid_until)}`);
  return lines.join('\n');
}

// ── Generator ─────────────────────────────────────────────────

function generateYear(year) {
  const jan1  = new Date(year, 0, 1);
  const now   = new Date();
  const isCurrentYear = year === now.getFullYear();
  const lastMonth     = isCurrentYear ? now.getMonth() : 11; // up to current month or Dec

  const estimates = [];
  const known     = [];
  const actuals   = [];

  // Monthly fixed costs — planned_known monthly
  for (const cost of MONTHLY_FIXED) {
    known.push(entry({
      date:           jan1,
      amount:         cost.amount,
      spend_type:     'planned_known',
      periodicity:    'monthly',
      spend_category: cost.category,
      description:    cost.description,
    }));
  }

  // Annual costs — planned_known annual + matching actual_spend
  for (const cost of ANNUAL_COSTS) {
    const planned = jitter(cost.base);
    known.push(entry({
      date:           jan1,
      amount:         planned,
      spend_type:     'planned_known',
      periodicity:    'annual',
      spend_category: cost.category,
      description:    cost.description,
    }));

    // Actual spend — arrives at a random point in the year (or not yet if current year)
    const payMonth = Math.floor(Math.random() * (lastMonth + 1));
    const actual   = jitter(cost.base, 0.12); // slightly more variance in actual
    actuals.push(entry({
      date:           randomDayInMonth(year, payMonth),
      amount:         actual,
      spend_type:     'actual_spend',
      periodicity:    'annual',
      spend_category: cost.category,
      description:    `${cost.description} — paid`,
    }));
  }

  // Planned estimates
  estimates.push(entry({
    date:           jan1,
    amount:         jitter(2000, 0.2),
    spend_type:     'planned_estimate',
    periodicity:    'annual',
    spend_category: 'holiday',
    description:    'Holiday budget estimate',
  }));

  // Unplanned actual_spend (no committed counterpart)
  for (const cat of UNPLANNED) {
    for (let month = 0; month <= lastMonth; month++) {
      for (let t = 0; t < cat.transactions; t++) {
        actuals.push(entry({
          date:           randomDayInMonth(year, month),
          amount:         jitter(cat.monthlyAvg / cat.transactions, 0.3),
          spend_type:     'actual_spend',
          periodicity:    'annual',
          spend_category: cat.category,
          description:    cat.description,
        }));
      }
    }
  }

  // Sort actuals by date for readability
  actuals.sort((a, b) => {
    const da = a.match(/date: (\S+)/)[1];
    const db = b.match(/date: (\S+)/)[1];
    return da.localeCompare(db);
  });

  const yamlLines = [
    '# ── Planned estimate ──────────────────────────────',
    ...estimates,
    '',
    '# ── Planned known ─────────────────────────────────',
    ...known,
    '',
    '# ── Actual spend ──────────────────────────────────',
    ...actuals,
  ].join('\n');

  return [
    '---',
    'tl_type: register',
    `year: ${year}`,
    '---',
    '',
    '```yaml',
    yamlLines,
    '```',
    '',
  ].join('\n');
}

// ── Write files ───────────────────────────────────────────────

fs.mkdirSync(outDir, { recursive: true });

for (let year = startYear; year <= endYear; year++) {
  const content  = generateYear(year);
  const filePath = path.join(outDir, `${year}.md`);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  ✓ ${filePath}`);
}

console.log(`\nGenerated ${endYear - startYear + 1} year(s) in ${outDir}`);
