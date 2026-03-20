import type { BudgetEntry } from './types';
import {
  monthlyValue, annualValue, monthsToDate,
  spendInMonth, sumByCategory,
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
  year: number,
  currency: string,
): void {
  const table = parent.createEl('table', { cls: 'tl-table' });
  const hr    = table.createEl('thead').createEl('tr');
  ['Description', 'Per Month'].forEach(h => hr.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');
  let tMonthly = 0;

  records
    .filter(r => (r.spend_type === 'planned_known' || r.spend_type === 'planned_estimate') && r.periodicity === 'monthly')
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

  const committed  = records.filter(r => r.spend_type === 'planned_known' || r.spend_type === 'planned_estimate');
  const monthSpend = spendInMonth(records, year, month);

  const committedByCat = sumByCategory(committed,  r => monthlyValue(r, year, month));
  const spentByCat     = sumByCategory(monthSpend, r => r.amount);

  const annualInstallment = committedByCat.annual  || 0;
  const fixedCosts        = committedByCat.monthly || 0;
  const totalSpent        = Object.values(spentByCat).reduce((a, b) => a + b, 0);

  renderSummaryCards(cardsContainer, [
    { label: 'Annual Installment',       value: fmt(annualInstallment, currency) },
    { label: 'Fixed Costs',              value: fmt(fixedCosts, currency)         },
    { label: 'Spend This Month',         value: fmt(totalSpent, currency)         },
    { label: 'Total',                    value: fmt(annualInstallment + fixedCosts + totalSpent, currency) },
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
  // Group by spend_category so multiple entries sharing a slug collapse to one row.
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
    const total        = entries.reduce((s, r) => s + annualValue(r, year), 0);
    const spent        = spentFn(entries);
    const expandable   = entries.length > 1;

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

export function renderAnnual(
  blueContainer: HTMLElement,
  purpleContainer: HTMLElement,
  records: BudgetEntry[],
  year: number,
  currency: string,
): void {
  blueContainer.empty();
  purpleContainer.empty();

  const committed = records.filter(r => r.spend_type === 'planned_known' || r.spend_type === 'planned_estimate');
  const spend     = records.filter(r => r.spend_type === 'actual_spend');

  const rows = [
    {
      label: 'Annual Costs',
      total: committed.filter(r => r.periodicity === 'annual').reduce((s, r) => s + annualValue(r, year), 0),
      spent: spend.filter(r => r.periodicity === 'annual').reduce((s, r) => s + r.amount, 0),
    },
    {
      label: 'Monthly Fixed Costs',
      total: committed.filter(r => r.periodicity === 'monthly').reduce((s, r) => s + annualValue(r, year), 0),
      spent: spend.filter(r => r.periodicity === 'monthly').reduce((s, r) => s + r.amount, 0),
    },
  ];

  // Summary table
  const table = blueContainer.createEl('table', { cls: 'tl-table tl-annual-summary-table' });
  const hr    = table.createEl('thead').createEl('tr');
  ['Frequency', 'Total', 'Spend To Date', 'Remaining Commitment'].forEach(h => hr.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');
  rows.forEach(({ label, total, spent }) => {
    const tr = tbody.createEl('tr');
    tr.createEl('td', { text: label });
    tr.createEl('td', { text: fmt(total, currency) });
    tr.createEl('td', { text: fmt(spent, currency) });
    tr.createEl('td', { text: fmt(total - spent, currency) });
  });
  const tTotal = rows.reduce((s, r) => s + r.total, 0);
  const tSpent = rows.reduce((s, r) => s + r.spent, 0);
  const tfr    = table.createEl('tfoot').createEl('tr');
  ['Total', fmt(tTotal, currency), fmt(tSpent, currency), fmt(tTotal - tSpent, currency)]
    .forEach(val => tfr.createEl('td', { text: val }));

  // Detail breakdown
  const spendByCat: Record<string, number> = {};
  spend.forEach(r => {
    spendByCat[r.spend_category] = (spendByCat[r.spend_category] || 0) + r.amount;
  });

  renderDetailTable(
    blueContainer, 'Annual Costs Detail',
    committed.filter(r => r.periodicity === 'annual'),
    year, currency,
    entries => spendByCat[entries[0].spend_category] || 0,
  );
  renderDetailTable(
    purpleContainer, 'Monthly Fixed Costs Detail',
    committed.filter(r => r.periodicity === 'monthly'),
    year, currency,
    entries => entries.reduce((s, r) => s + monthsToDate(r, year) * r.amount, 0),
  );
}
