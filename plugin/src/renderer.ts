import type { BudgetEntry } from './types';
import {
  monthlyValue, annualValue, monthsToDate,
  spendInMonth,
  fmt, fmtCat,
} from './logic';

export function renderNavBar(
  parent: HTMLElement,
  label: string,
  onPrev: () => void,
  onNext: () => void,
  prevEnabled = true,
  nextEnabled = true,
): void {
  const bar  = parent.createEl('div', { cls: 'tl-nav' });
  const prev = bar.createEl('button', { text: '◀', cls: 'tl-nav-btn' });
  bar.createEl('span', { text: label, cls: 'tl-nav-label' });
  const next = bar.createEl('button', { text: '▶', cls: 'tl-nav-btn' });
  prev.disabled = !prevEnabled;
  next.disabled = !nextEnabled;
  prev.onclick = onPrev;
  next.onclick = onNext;
}

export function renderSummaryCards(
  parent: HTMLElement,
  cols: { label: string; value: string }[],
): void {
  const table = parent.createEl('table', { cls: 'tl-table tl-summary-table' });
  const thead = table.createEl('thead').createEl('tr');
  const tbody = table.createEl('tbody').createEl('tr');
  cols.forEach(({ label, value }) => {
    thead.createEl('th', { text: label });
    tbody.createEl('td', { text: value, attr: { 'data-label': label } });
  });
}

export function renderCommitmentsTable(
  parent: HTMLElement,
  records: BudgetEntry[],
  _year: number,
  currency: string,
): void {
  const table = parent.createEl('table', { cls: 'tl-table' });
  const hr    = table.createEl('thead').createEl('tr');
  ['Description', 'Per Month'].forEach(h => hr.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');
  let tMonthly = 0;

  records
    .filter(r => r.spend_type === 'monthly_fixed')
    .sort((a, b) => a.description.localeCompare(b.description))
    .forEach(r => {
      tMonthly += r.amount;
      const tr = tbody.createEl('tr');
      tr.createEl('td', { text: r.description });
      tr.createEl('td', { text: fmt(r.amount, currency) });
    });

  const tr = table.createEl('tfoot').createEl('tr');
  ['Total', fmt(tMonthly, currency)].forEach(val => tr.createEl('td', { text: val }));
}

export function renderMonthSpendList(
  parent: HTMLElement,
  spendRecords: BudgetEntry[],
  currency: string,
): void {
  if (spendRecords.length === 0) return;
  const table = parent.createEl('table', { cls: 'tl-table tl-spend-table' });
  const hr    = table.createEl('thead').createEl('tr');
  ['Date', 'Description', 'Category', 'Amount'].forEach(h => hr.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');
  [...spendRecords]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .forEach(r => {
      const tr = tbody.createEl('tr');
      tr.createEl('td', { text: r.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) });
      tr.createEl('td', { text: r.description });
      tr.createEl('td', { text: fmtCat(r.spend_category) });
      tr.createEl('td', { text: fmt(r.amount, currency) });
    });
}

export function renderMonth(
  cardsContainer: HTMLElement,
  spendContainer: HTMLElement,
  dayInfoEl: HTMLElement,
  records: BudgetEntry[],
  year: number,
  month: number,
  currency: string,
): void {
  cardsContainer.empty();
  spendContainer.empty();

  const now            = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  if (isCurrentMonth) {
    const daysInMonth      = new Date(year, month + 1, 0).getDate();
    dayInfoEl.textContent  = `Day ${now.getDate()} of ${daysInMonth} — month in progress`;
    dayInfoEl.style.display = '';
  } else {
    dayInfoEl.style.display = 'none';
  }

  const annualEstimates = records.filter(r => r.spend_type === 'annual_estimate');
  const monthlyFixeds = records.filter(r => r.spend_type === 'monthly_fixed');
  const monthSpend    = spendInMonth(records, year, month);

  const annualInstallment = annualEstimates.reduce((s, r) => s + monthlyValue(r, year, month), 0);
  const fixedCosts        = monthlyFixeds.reduce((s, r) => s + monthlyValue(r, year, month), 0);
  const totalSpent        = monthSpend.reduce((s, r) => s + r.amount, 0);

  renderSummaryCards(cardsContainer, [
    { label: 'Annual Installment', value: fmt(annualInstallment, currency) },
    { label: 'Fixed Costs',        value: fmt(fixedCosts, currency)         },
    { label: 'Spend This Month',   value: fmt(totalSpent, currency)         },
    { label: 'Total',              value: fmt(annualInstallment + fixedCosts + totalSpent, currency) },
  ]);

  renderMonthSpendList(spendContainer, monthSpend, currency);
}

function renderDetailTable(
  parent: HTMLElement,
  subtitle: string,
  records: BudgetEntry[],
  year: number,
  currency: string,
  spentFn: (entries: BudgetEntry[]) => number,
): void {
  const byCategory = new Map<string, BudgetEntry[]>();
  for (const r of records) {
    if (!byCategory.has(r.spend_category)) byCategory.set(r.spend_category, []);
    byCategory.get(r.spend_category)!.push(r);
  }

  parent.createEl('div', { text: subtitle, cls: 'tl-subsection-label' });
  const table = parent.createEl('table', { cls: 'tl-table tl-detail-table' });
  const hr    = table.createEl('thead').createEl('tr');
  ['Category', 'Total', 'Spend To Date', 'Remaining Commitment'].forEach(h => hr.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');

  for (const [cat, entries] of [...byCategory].sort((a, b) => a[0].localeCompare(b[0]))) {
    const total      = entries.reduce((s, r) => s + annualValue(r, year), 0);
    const spent      = spentFn(entries);
    const expandable = entries.length > 1;

    const tr = tbody.createEl('tr', { cls: expandable ? 'tl-detail-row tl-detail-row--expandable' : 'tl-detail-row' });
    const catCell = tr.createEl('td');
    if (expandable) catCell.createEl('span', { text: '▶', cls: 'tl-chevron' });
    catCell.createEl('span', { text: fmtCat(cat) });
    tr.createEl('td', { text: fmt(total, currency) });
    tr.createEl('td', { text: spent ? fmt(spent, currency) : '—' });
    tr.createEl('td', { text: fmt(total - spent, currency) });

    if (expandable) {
      const subRows = [...entries]
        .sort((a, b) => a.description.localeCompare(b.description))
        .map(r => {
          const sub = tbody.createEl('tr', { cls: 'tl-detail-sub' });
          sub.createEl('td', { text: r.description, cls: 'tl-detail-sub-desc' });
          sub.createEl('td', { text: fmt(annualValue(r, year), currency) });
          sub.createEl('td', { text: '—' });
          sub.createEl('td', { text: '—' });
          return sub;
        });

      tr.addEventListener('click', () => {
        const expanding = !tr.hasClass('tl-detail-row--expanded');
        tr.toggleClass('tl-detail-row--expanded', expanding);
        subRows.forEach(s => s.toggleClass('tl-detail-sub--visible', expanding));
      });
    }
  }
}

function renderAnnualSummaryTable(
  parent: HTMLElement,
  records: BudgetEntry[],
  year: number,
  currency: string,
): void {
  const annualEstimates = records.filter(r => r.spend_type === 'annual_estimate');
  const monthlyFixeds = records.filter(r => r.spend_type === 'monthly_fixed');
  const actuals       = records.filter(r => r.spend_type === 'actual_spend');

  const annualEstimateCats = new Set(annualEstimates.map(r => r.spend_category));
  const monthlyFixedCats = new Set(monthlyFixeds.map(r => r.spend_category));

  const rows = [
    {
      label: 'Annual Estimates',
      total: annualEstimates.reduce((s, r) => s + annualValue(r, year), 0),
      spent: actuals.filter(r => annualEstimateCats.has(r.spend_category)).reduce((s, r) => s + r.amount, 0),
    },
    {
      label: 'Monthly Fixed',
      total: monthlyFixeds.reduce((s, r) => s + annualValue(r, year), 0),
      spent: actuals.filter(r => monthlyFixedCats.has(r.spend_category)).reduce((s, r) => s + r.amount, 0),
    },
  ];

  const table = parent.createEl('table', { cls: 'tl-table tl-annual-summary-table' });
  const hr    = table.createEl('thead').createEl('tr');
  ['Category', 'Total', 'Spend To Date', 'Remaining Commitment'].forEach(h => hr.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');
  rows.forEach(({ label, total, spent }) => {
    const tr = tbody.createEl('tr');
    tr.createEl('td', { text: label });
    tr.createEl('td', { text: fmt(total, currency),         attr: { 'data-label': 'Total' } });
    tr.createEl('td', { text: fmt(spent, currency),         attr: { 'data-label': 'Spent' } });
    tr.createEl('td', { text: fmt(total - spent, currency), attr: { 'data-label': 'Remaining' } });
  });
  const tTotal = rows.reduce((s, r) => s + r.total, 0);
  const tSpent = rows.reduce((s, r) => s + r.spent, 0);
  const tfr    = table.createEl('tfoot').createEl('tr');
  ['Total', fmt(tTotal, currency), fmt(tSpent, currency), fmt(tTotal - tSpent, currency)]
    .forEach(val => tfr.createEl('td', { text: val }));
}

export function renderYoY(
  parent: HTMLElement,
  allYears: { year: number; records: BudgetEntry[] }[],
  currentYear: number,
  currency: string,
): void {
  if (allYears.length === 0) {
    parent.createEl('p', { text: 'No registers found.', cls: 'tl-empty' });
    return;
  }
  [...allYears]
    .sort((a, b) => b.year - a.year)
    .forEach(({ year, records }) => {
      const isCurrent = year === currentYear;
      const section   = parent.createEl('div', {
        cls: 'tl-section tl-section--blue' + (isCurrent ? ' tl-section--yoy-current' : ''),
      });
      const header = section.createEl('div', { cls: 'tl-section-header' });
      header.createEl('span', { text: String(year), cls: 'tl-section-title tl-yoy-year-title' });
      if (isCurrent) {
        header.createEl('span', { text: 'Current', cls: 'tl-yoy-current-badge' });
      }
      renderAnnualSummaryTable(section, records, year, currency);
    });
}

export function renderAnnual(
  blueContainer: HTMLElement,
  purpleContainer: HTMLElement,
  greenContainer: HTMLElement,
  records: BudgetEntry[],
  year: number,
  currency: string,
): void {
  blueContainer.empty();
  purpleContainer.empty();
  greenContainer.empty();

  const annualEstimates = records.filter(r => r.spend_type === 'annual_estimate');
  const monthlyFixeds = records.filter(r => r.spend_type === 'monthly_fixed');
  const actuals       = records.filter(r => r.spend_type === 'actual_spend');

  // Summary table
  renderAnnualSummaryTable(blueContainer, records, year, currency);

  // Spend lookup by category
  const spendByCat: Record<string, number> = {};
  actuals.forEach(r => { spendByCat[r.spend_category] = (spendByCat[r.spend_category] || 0) + r.amount; });

  // Detail breakdowns
  renderDetailTable(
    blueContainer, 'Annual Estimates Detail',
    annualEstimates,
    year, currency,
    entries => spendByCat[entries[0].spend_category] || 0,
  );
  renderDetailTable(
    purpleContainer, 'Monthly Fixed Detail',
    monthlyFixeds,
    year, currency,
    entries => spendByCat[entries[0].spend_category] || 0,
  );

  // Unplanned: actuals with no plan counterpart
  const allPlanCats = new Set([
    ...annualEstimates.map(r => r.spend_category),
    ...monthlyFixeds.map(r => r.spend_category),
  ]);
  const unplannedByCat = new Map<string, { total: number; count: number }>();
  for (const r of actuals) {
    if (!allPlanCats.has(r.spend_category)) {
      const entry = unplannedByCat.get(r.spend_category) ?? { total: 0, count: 0 };
      entry.total += r.amount;
      entry.count += 1;
      unplannedByCat.set(r.spend_category, entry);
    }
  }

  if (unplannedByCat.size > 0) {
    const table = greenContainer.createEl('table', { cls: 'tl-table' });
    const hr    = table.createEl('thead').createEl('tr');
    ['Category', 'Transactions', 'Spend To Date'].forEach(h => hr.createEl('th', { text: h }));
    const tbody = table.createEl('tbody');
    let grandTotal = 0;
    for (const [cat, { total, count }] of [...unplannedByCat].sort((a, b) => a[0].localeCompare(b[0]))) {
      grandTotal += total;
      const tr = tbody.createEl('tr');
      tr.createEl('td', { text: fmtCat(cat) });
      tr.createEl('td', { text: String(count) });
      tr.createEl('td', { text: fmt(total, currency) });
    }
    const tfr = table.createEl('tfoot').createEl('tr');
    ['Total', '', fmt(grandTotal, currency)].forEach(v => tfr.createEl('td', { text: v }));
  } else {
    greenContainer.createEl('p', { text: 'No unplanned spend this year.', cls: 'tl-empty' });
  }
}
