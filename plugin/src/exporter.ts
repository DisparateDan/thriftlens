import type { BudgetEntry } from './types';
import {
  monthlyValue, annualValue, monthsToDate,
  spendInMonth, sumByCategory,
  fmt, fmtCat, MONTH_NAMES,
} from './logic';

// ── HTML helpers ──────────────────────────────────────────────────

function tag(el: string, attrs: Record<string, string>, content: string): string {
  const attrStr = Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join('');
  return `<${el}${attrStr}>${content}</${el}>`;
}

function td(content: string, style = ''): string {
  return tag('td', style ? { style } : {}, content);
}

function th(content: string, style = ''): string {
  return tag('th', style ? { style } : {}, content);
}

// ── Styles ────────────────────────────────────────────────────────

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.5;
    color: #1a1a1a;
    background: #f5f5f5;
    padding: 2em;
  }
  .report {
    max-width: 720px;
    margin: 0 auto;
  }
  header {
    margin-bottom: 2em;
    padding-bottom: 1em;
    border-bottom: 2px solid #ddd;
  }
  header h1 {
    font-size: 1.6em;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #111;
  }
  header p {
    font-size: 0.85em;
    color: #888;
    margin-top: 0.25em;
  }
  .section {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 10px;
    padding: 1.5em;
    margin-bottom: 1.5em;
  }
  .section-title {
    font-size: 0.68em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #888;
    margin-bottom: 1em;
    padding-bottom: 0.5em;
    border-bottom: 1px solid #eee;
  }
  .section--blue  { border-left: 3px solid rgba(100,140,220,0.7); }
  .section--purple { border-left: 3px solid rgba(160,100,220,0.7); }
  .subsection-label {
    font-size: 0.68em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #aaa;
    margin: 1.5em 0 0.5em;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88em;
  }
  thead th {
    text-align: right;
    padding: 0.45em 0.85em;
    font-size: 0.72em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #888;
    background: #f9f9f9;
    border-bottom: 1px solid #e8e8e8;
  }
  thead th:first-child { text-align: left; }
  tbody td {
    text-align: right;
    padding: 0.5em 0.85em;
    border-bottom: 1px solid #f0f0f0;
    font-variant-numeric: tabular-nums;
  }
  tbody td:first-child { text-align: left; }
  tbody tr:last-child td { border-bottom: none; }
  tfoot td {
    text-align: right;
    padding: 0.65em 0.85em 0.3em;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    border-top: 2px solid #e0e0e0;
    color: #444;
  }
  tfoot td:first-child { text-align: left; }
  .summary-table thead th { text-align: center; }
  .summary-table tbody td {
    text-align: center;
    font-size: 1.5em;
    font-weight: 800;
    padding: 0.5em 1em;
    border-bottom: none;
    letter-spacing: -0.02em;
  }
  .empty { color: #bbb; font-style: italic; font-size: 0.9em; padding: 0.75em 0; }
`;

// ── Section builders ──────────────────────────────────────────────

function summaryTable(cols: { label: string; value: string }[]): string {
  const headers = cols.map(c => th(c.label)).join('');
  const cells   = cols.map(c => td(c.value)).join('');
  return `<table class="summary-table">
    <thead><tr>${headers}</tr></thead>
    <tbody><tr>${cells}</tr></tbody>
  </table>`;
}

function dataTable(headers: string[], rows: string[][], footer?: string[]): string {
  const head = headers.map(h => th(h)).join('');
  const body = rows.map(r => `<tr>${r.map(c => td(c)).join('')}</tr>`).join('');
  const foot = footer
    ? `<tfoot><tr>${footer.map(c => td(c)).join('')}</tr></tfoot>`
    : '';
  return `<table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body || `<tr><td colspan="${headers.length}" class="empty">No entries</td></tr>`}</tbody>
    ${foot}
  </table>`;
}

// ── Monthly section ───────────────────────────────────────────────

function renderMonthlySection(
  records: BudgetEntry[],
  year: number,
  month: number,
  currency: string,
): string {
  const committed  = records.filter(r => r.spend_type === 'planned_known' || r.spend_type === 'planned_estimate');
  const monthSpend = spendInMonth(records, year, month);

  const committedByCat    = sumByCategory(committed,  r => monthlyValue(r, year, month));
  const spentByCat        = sumByCategory(monthSpend, r => r.amount);
  const annualInstallment = committedByCat.annual  || 0;
  const fixedCosts        = committedByCat.monthly || 0;
  const totalSpent        = Object.values(spentByCat).reduce((a, b) => a + b, 0);

  const summary = summaryTable([
    { label: 'Annual Costs Installment', value: fmt(annualInstallment, currency) },
    { label: 'Fixed Costs',              value: fmt(fixedCosts, currency) },
    { label: 'Spend This Month',         value: fmt(totalSpent, currency) },
    { label: 'Total',                    value: fmt(annualInstallment + fixedCosts + totalSpent, currency) },
  ]);

  // Fixed costs detail
  const fixedRows: string[][] = [];
  let fixedTotal = 0;
  committed
    .filter(r => r.periodicity === 'monthly')
    .forEach(r => { fixedTotal += r.amount; fixedRows.push([r.description, fmt(r.amount, currency)]); });
  const fixedTable = dataTable(['Description', 'Per Month'], fixedRows, ['Total', fmt(fixedTotal, currency)]);

  // Transactions
  const txRows: string[][] = [...monthSpend]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(r => [
      r.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      r.description,
      fmtCat(r.spend_category),
      fmt(r.amount, currency),
    ]);

  const txSection = txRows.length > 0
    ? `<p class="subsection-label">Transactions</p>${dataTable(['Date', 'Description', 'Category', 'Amount'], txRows)}`
    : '';

  return `
    <div class="section section--blue">
      <p class="section-title">${MONTH_NAMES[month]} ${year}</p>
      ${summary}
      <p class="subsection-label">Fixed Costs Detail</p>
      ${fixedTable}
      ${txSection}
    </div>`;
}

// ── Annual section ────────────────────────────────────────────────

function renderAnnualSection(records: BudgetEntry[], year: number, currency: string): string {
  const committed = records.filter(r => r.spend_type === 'planned_known' || r.spend_type === 'planned_estimate');
  const spend     = records.filter(r => r.spend_type === 'actual_spend');

  const spendByCat: Record<string, number> = {};
  spend.forEach(r => { spendByCat[r.spend_category] = (spendByCat[r.spend_category] || 0) + r.amount; });

  const annualCommitted = committed.filter(r => r.periodicity === 'annual');
  const monthlyCommitted = committed.filter(r => r.periodicity === 'monthly');

  const rows = [
    {
      label: 'Annual Costs',
      total: annualCommitted.reduce((s, r) => s + annualValue(r, year), 0),
      spent: spend.filter(r => r.periodicity === 'annual').reduce((s, r) => s + r.amount, 0),
    },
    {
      label: 'Monthly Fixed Costs',
      total: monthlyCommitted.reduce((s, r) => s + annualValue(r, year), 0),
      spent: spend.filter(r => r.periodicity === 'monthly').reduce((s, r) => s + r.amount, 0),
    },
  ];

  const tTotal = rows.reduce((s, r) => s + r.total, 0);
  const tSpent = rows.reduce((s, r) => s + r.spent, 0);

  const summaryRows = rows.map(r => [
    r.label, fmt(r.total, currency), fmt(r.spent, currency), fmt(r.total - r.spent, currency),
  ]);
  const summaryTable = dataTable(
    ['Frequency', 'Total', 'Spend To Date', 'Remaining'],
    summaryRows,
    ['Total', fmt(tTotal, currency), fmt(tSpent, currency), fmt(tTotal - tSpent, currency)],
  );

  // Annual detail
  const annualDetailRows = annualCommitted.map(r => {
    const total = annualValue(r, year);
    const spent = spendByCat[r.spend_category] || 0;
    return [fmtCat(r.spend_category), fmt(total, currency), spent ? fmt(spent, currency) : '—', fmt(total - spent, currency)];
  });

  // Monthly fixed detail
  const monthlyDetailRows = monthlyCommitted.map(r => {
    const total = annualValue(r, year);
    const spent = monthsToDate(r, year) * r.amount;
    return [fmtCat(r.spend_category), fmt(total, currency), fmt(spent, currency), fmt(total - spent, currency)];
  });

  const detailHeaders = ['Category', 'Total', 'Spend To Date', 'Remaining'];

  return `
    <div class="section section--blue">
      <p class="section-title">${year} — Annual Summary</p>
      ${summaryTable}
      <p class="subsection-label">Annual Costs Detail</p>
      ${dataTable(detailHeaders, annualDetailRows)}
    </div>
    <div class="section section--purple">
      <p class="section-title">Monthly Fixed Costs Detail</p>
      ${dataTable(detailHeaders, monthlyDetailRows)}
    </div>`;
}

// ── Entry point ───────────────────────────────────────────────────

export function generateReport(
  monthRecords: BudgetEntry[],
  annualRecords: BudgetEntry[],
  year: number,
  month: number,
  currency: string,
): string {
  const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const title     = `ThriftLens — ${MONTH_NAMES[month]} ${year}`;

  const monthly = renderMonthlySection(monthRecords, year, month, currency);
  const annual  = renderAnnualSection(annualRecords, year, currency);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="report">
    <header>
      <h1>${title}</h1>
      <p>Generated ${generated}</p>
    </header>
    ${monthly}
    ${annual}
  </div>
</body>
</html>`;
}
