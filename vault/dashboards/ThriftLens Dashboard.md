<style>
.budget-dashboard .budget-section {
  margin-bottom: 2em;
  padding: 1em 1.25em;
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
}
.budget-dashboard .budget-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1em;
  padding-bottom: 0.75em;
  border-bottom: 2px solid var(--background-modifier-border);
}
.budget-dashboard .budget-nav {
  display: flex;
  align-items: center;
  gap: 0.75em;
}
.budget-dashboard .budget-nav-label {
  font-size: 1.1em;
  font-weight: 600;
  min-width: 6em;
  text-align: center;
}
.budget-dashboard .budget-nav-btn {
  background: var(--interactive-normal);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 0.2em 0.6em;
  cursor: pointer;
  font-size: 0.9em;
}
.budget-dashboard .budget-nav-btn:hover { background: var(--interactive-hover); }
.budget-dashboard .budget-cards {
  display: flex;
  gap: 0.75em;
  margin-bottom: 1.25em;
  flex-wrap: wrap;
}
.budget-dashboard .budget-card {
  flex: 1;
  min-width: 110px;
  padding: 0.6em 0.9em;
  border-radius: 6px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
}
.budget-dashboard .budget-card-label {
  font-size: 0.75em;
  color: var(--text-muted);
  margin-bottom: 0.2em;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.budget-dashboard .budget-card-value {
  font-size: 1.2em;
  font-weight: 600;
}
.budget-dashboard .budget-positive { color: var(--color-green); }
.budget-dashboard .budget-negative { color: var(--color-red); }
.budget-dashboard .budget-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
  margin-bottom: 1.25em;
}
.budget-dashboard .budget-table th {
  text-align: right;
  padding: 0.4em 0.75em;
  color: var(--text-muted);
  font-weight: 500;
  font-size: 0.85em;
  border: 1px solid rgba(255, 255, 255, 0.3);
}
.budget-dashboard .budget-table td {
  text-align: right;
  padding: 0.45em 0.75em;
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.budget-dashboard .budget-table th:first-child,
.budget-dashboard .budget-table td:first-child { text-align: left; }
.budget-dashboard .budget-total-row td {
  font-weight: 600;
  border-top: 2px solid rgba(255, 255, 255, 0.3);
  border-bottom: none;
}
.budget-dashboard .budget-summary-table td {
  font-size: 1.2em;
  font-weight: 600;
  padding-top: 0.3em;
  padding-bottom: 0.75em;
}
.budget-dashboard .budget-section-heading {
  font-size: 1.3em;
  font-weight: 700;
  color: var(--text-normal);
  margin: 0;
}
.budget-dashboard .budget-section-title {
  font-size: 0.8em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin: 1.25em 0 0.5em;
}
</style>

```dataviewjs
// ═══════════════════════════════════════════════════════════════
// PURE LOGIC — no DataviewJS/Obsidian dependencies
// (these functions move unchanged into the plugin)
// ═══════════════════════════════════════════════════════════════

// Number of months a record is active within a given year.
function monthsActiveInYear(record, year) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd   = new Date(year, 11, 31);
  if (record.date > yearEnd) return 0;
  if (record.valid_until && record.valid_until < yearStart) return 0;
  const start = record.date > yearStart ? record.date : yearStart;
  const end   = record.valid_until && record.valid_until < yearEnd ? record.valid_until : yearEnd;
  return end.getMonth() - start.getMonth() + 1;
}

// Annualised value of a budget or repeating record.
// annual costs are lump sums (amortised ÷12 per month); monthly costs scale by months active.
function annualValue(record, year) {
  if (record.periodicity === 'annual') {
    const yearStart = new Date(year, 0, 1);
    const yearEnd   = new Date(year, 11, 31);
    if (record.date > yearEnd) return 0;
    if (record.valid_until && record.valid_until < yearStart) return 0;
    return record.amount;
  }
  return record.amount * monthsActiveInYear(record, year);
}

// Monthly value of a budget or repeating record for a given year+month (0-indexed).
function monthlyValue(record, year, month) {
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0);
  if (record.date > monthEnd) return 0;
  if (record.valid_until && record.valid_until < monthStart) return 0;
  return record.periodicity === 'annual' ? record.amount / 12 : record.amount;
}

// Spend records falling within a given year+month (0-indexed).
function spendInMonth(records, year, month) {
  return records.filter(r =>
    r.spend_type === 'unplanned' &&
    r.date.getFullYear() === year &&
    r.date.getMonth() === month
  );
}

const CURRENCY = '€';

function fmtCat(s) {
  return (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmt(n) {
  return CURRENCY + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const CAT_ORDER  = ['monthly', 'annual'];
const CAT_LABELS = {
  monthly: 'Monthly',
  annual:  'Annual',
};

function sumByCategory(records, valueFn) {
  const out = Object.fromEntries(CAT_ORDER.map(c => [c, 0]));
  records.forEach(r => { if (r.periodicity in out) out[r.periodicity] += valueFn(r); });
  return out;
}

// ═══════════════════════════════════════════════════════════════
// DATA LOADING — Dataview/Obsidian API (swap for plugin.app on migration)
// ═══════════════════════════════════════════════════════════════

function parseDate(str) {
  if (!str || !String(str).trim()) return null;
  const [y, m, d] = String(str).trim().split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Parse the yaml fenced block from a file's body into record objects.
function parseRecordsBlock(text) {
  const records = [];
  let current = null;
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
      ...r,
      amount:      parseFloat(r.amount) || 0,
      date:        parseDate(r.date),
      valid_until: parseDate(r.valid_until) || null,
    }));
}

async function loadYear(year) {
  const page = dv.pages('"budget"')
    .where(p => p.tl_type === 'record' && p.year === year)
    .first();
  if (!page) return [];
  const content = await app.vault.read(app.vault.getAbstractFileByPath(page.file.path));
  const match = content.match(/```yaml\n([\s\S]*?)\n```/);
  return match ? parseRecordsBlock(match[1]) : [];
}

// ═══════════════════════════════════════════════════════════════
// RENDERING — DataviewJS DOM (swap for ItemView on migration)
// ═══════════════════════════════════════════════════════════════

function renderNavBar(parent, label, onPrev, onNext) {
  const bar = parent.createEl('div', { cls: 'budget-nav' });
  const prev = bar.createEl('button', { text: '◀', cls: 'budget-nav-btn' });
  bar.createEl('span', { text: label, cls: 'budget-nav-label' });
  const next = bar.createEl('button', { text: '▶', cls: 'budget-nav-btn' });
  prev.onclick = onPrev;
  next.onclick = onNext;
}

function renderSummaryCards(parent, cols) {
  const table = parent.createEl('table', { cls: 'budget-table budget-summary-table', attr: { style: 'width:100%' } });
  const thead = table.createEl('thead').createEl('tr');
  const tbody = table.createEl('tbody').createEl('tr');
  cols.forEach(({ label, value }) => {
    thead.createEl('th', { text: label });
    tbody.createEl('td', { text: value });
  });
}

function renderSpendByCategoryTable(parent, spendRecords) {
  if (spendRecords.length === 0) return;
  const totals = {};
  spendRecords.forEach(r => {
    const cat = r.spend_category || '(uncategorised)';
    totals[cat] = (totals[cat] || 0) + r.amount;
  });
  const table = parent.createEl('table', { cls: 'budget-table', attr: { style: 'width:100%' } });
  const hr = table.createEl('thead').createEl('tr');
  ['Category', 'Amount'].forEach(h => hr.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');
  let total = 0;
  Object.entries(totals).sort((a, b) => b[1] - a[1]).forEach(([cat, amount]) => {
    total += amount;
    const tr = tbody.createEl('tr');
    tr.createEl('td', { text: fmtCat(cat) });
    tr.createEl('td', { text: fmt(amount) });
  });
  const TOTAL_STYLE = 'font-weight:700;font-size:1.05em;color:var(--color-accent);border-top:2px solid rgba(255,255,255,0.4)';
  const tr = table.createEl('tfoot').createEl('tr');
  ['Total', fmt(total)].forEach(val =>
    tr.createEl('td', { text: val, attr: { style: TOTAL_STYLE } })
  );
}

function renderCommitmentsTable(parent, records, year) {
  const table = parent.createEl('table', { cls: 'budget-table', attr: { style: 'width:100%' } });
  const hr = table.createEl('thead').createEl('tr');
  ['Description', 'Per Month'].forEach(h => hr.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');
  let tMonthly = 0;

  records
    .filter(r => (r.spend_type === 'planned_known' || r.spend_type === 'planned_estimate') && r.periodicity === 'monthly')
    .forEach(r => {
      const monthly = r.amount;
      tMonthly += monthly;
      const tr = tbody.createEl('tr');
      tr.createEl('td', { text: r.description });
      tr.createEl('td', { text: fmt(monthly) });
    });

  const TOTAL_STYLE = 'font-weight:700;font-size:1.05em;color:var(--color-accent);border-top:2px solid rgba(255,255,255,0.4)';
  const tr = table.createEl('tfoot').createEl('tr');
  ['Total', fmt(tMonthly)].forEach(val =>
    tr.createEl('td', { text: val, attr: { style: TOTAL_STYLE } })
  );
}

function renderAnnual(container, records, year) {
  container.empty();

  const committed = records.filter(r => r.spend_type === 'planned_known' || r.spend_type === 'planned_estimate');
  const spend     = records.filter(r => r.spend_type === 'unplanned');

  const rows = [
    {
      label:   'Annual Costs',
      total:   committed.filter(r => r.periodicity === 'annual').reduce((s, r) => s + annualValue(r, year), 0),
      spent:   spend.filter(r => r.periodicity === 'annual').reduce((s, r) => s + r.amount, 0),
    },
    {
      label:   'Monthly Fixed Costs',
      total:   committed.filter(r => r.periodicity === 'monthly').reduce((s, r) => s + annualValue(r, year), 0),
      spent:   spend.filter(r => r.periodicity === 'monthly').reduce((s, r) => s + r.amount, 0),
    },
  ];

  const table = container.createEl('table', { cls: 'budget-table', attr: { style: 'width:100%' } });
  const hr = table.createEl('thead').createEl('tr');
  ['Frequency', 'Total', 'Spend To Date', 'Remaining Commitment'].forEach(h => hr.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');

  rows.forEach(({ label, total, spent }) => {
    const tr = tbody.createEl('tr');
    tr.createEl('td', { text: label });
    tr.createEl('td', { text: fmt(total) });
    tr.createEl('td', { text: fmt(spent) });
    tr.createEl('td', { text: fmt(total - spent) });
  });

  const TOTAL_STYLE = 'font-weight:700;font-size:1.05em;color:var(--color-accent);border-top:2px solid rgba(255,255,255,0.4)';
  const tTotal = rows.reduce((s, r) => s + r.total, 0);
  const tSpent = rows.reduce((s, r) => s + r.spent, 0);
  const tr = table.createEl('tfoot').createEl('tr');
  ['Total', fmt(tTotal), fmt(tSpent), fmt(tTotal - tSpent)].forEach(val =>
    tr.createEl('td', { text: val, attr: { style: TOTAL_STYLE } })
  );

  // Detailed breakdown — one row per committed record
  const spendByCat = {};
  spend.forEach(r => {
    const cat = r.spend_category || '';
    spendByCat[cat] = (spendByCat[cat] || 0) + r.amount;
  });

  function renderDetailTable(parent, subtitle, records) {
    parent.createEl('div', { text: subtitle, cls: 'budget-section-title' });
    const table = parent.createEl('table', { cls: 'budget-table', attr: { style: 'width:100%' } });
    const hr = table.createEl('thead').createEl('tr');
    ['Category', 'Total', 'Spend To Date', 'Remaining Commitment'].forEach(h => hr.createEl('th', { text: h }));
    const tbody = table.createEl('tbody');
    records.forEach(r => {
      const total     = annualValue(r, year);
      const spent     = spendByCat[r.spend_category] || 0;
      const tr = tbody.createEl('tr');
      tr.createEl('td', { text: fmtCat(r.spend_category) });
      tr.createEl('td', { text: fmt(total) });
      tr.createEl('td', { text: spent ? fmt(spent) : '—' });
      tr.createEl('td', { text: fmt(total - spent) });
    });
  }

  renderDetailTable(container, 'Annual Costs Detail',       committed.filter(r => r.periodicity === 'annual'));
  renderDetailTable(container, 'Monthly Fixed Costs Detail', committed.filter(r => r.periodicity === 'monthly'));
}

function renderMonthSpendList(parent, spendRecords) {
  if (spendRecords.length === 0) return;
  parent.createEl('div', { text: "This Month's Transactions", cls: 'budget-section-title' });
  const table = parent.createEl('table', { cls: 'budget-table', attr: { style: 'width:100%' } });
  const hr = table.createEl('thead').createEl('tr');
  ['Date', 'Description', 'Category', 'Amount'].forEach(h => hr.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');
  [...spendRecords]
    .sort((a, b) => a.date - b.date)
    .forEach(r => {
      const tr = tbody.createEl('tr');
      tr.createEl('td', { text: r.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) });
      tr.createEl('td', { text: r.description });
      tr.createEl('td', { text: fmtCat(r.spend_category) });
      tr.createEl('td', { text: fmt(r.amount) });
    });
}

function renderMonth(container, dayInfoEl, records, year, month) {
  container.empty();

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  if (isCurrentMonth) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    dayInfoEl.textContent = `Day ${now.getDate()} of ${daysInMonth} — month in progress`;
    dayInfoEl.style.display = '';
  } else {
    dayInfoEl.style.display = 'none';
  }

  const committed  = records.filter(r => r.spend_type === 'planned_known' || r.spend_type === 'planned_estimate');
  const monthSpend = spendInMonth(records, year, month);

  const committedByCat = sumByCategory(committed,  r => monthlyValue(r, year, month));
  const spentByCat     = sumByCategory(monthSpend, r => r.amount);

  const totalCommitted = Object.values(committedByCat).reduce((a, b) => a + b, 0);
  const totalSpent     = Object.values(spentByCat).reduce((a, b) => a + b, 0);

  const annualInstallment = committedByCat.annual  || 0;
  const fixedCosts        = committedByCat.monthly || 0;
  renderSummaryCards(container, [
    { label: 'Annual Costs Installment', value: fmt(annualInstallment) },
    { label: 'Fixed Costs',              value: fmt(fixedCosts)        },
    { label: 'Spend This Month',         value: fmt(totalSpent)        },
    { label: 'Total',                    value: fmt(annualInstallment + fixedCosts + totalSpent) },
  ]);
  renderMonthSpendList(container, monthSpend);
}

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATION — state, cache, wiring
// ═══════════════════════════════════════════════════════════════

const now = new Date();
const state = {
  annualYear: now.getFullYear(),
  monthYear:  now.getFullYear(),
  month:      now.getMonth(),   // 0-indexed
};

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

// Inject styles via JS — more reliable than a markdown <style> tag in Obsidian
const styleEl = document.createElement('style');
styleEl.textContent = `
  .budget-dashboard .budget-table th { border: 1px solid rgba(255,255,255,0.3) !important; }
  .budget-dashboard .budget-table td { border: 1px solid rgba(255,255,255,0.15) !important; }
`;
document.head.appendChild(styleEl);

const root = dv.container;
root.addClass('budget-dashboard');

const HEADER_STYLE       = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:1em;padding-bottom:0.75em;border-bottom:2px solid var(--background-modifier-border)';
const INNER_HEADER_STYLE = 'margin-bottom:0.75em;padding-bottom:0.5em;border-bottom:1px solid var(--background-modifier-border)';
const TITLE_STYLE        = 'font-size:1.3em;font-weight:700;margin:0';
const INNER_TITLE_STYLE  = 'font-size:1em;font-weight:600;margin:0;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em';

// Outer monthly wrapper
const monthlyOuter       = root.createEl('div', { cls: 'budget-section', attr: { style: 'background: rgba(100, 140, 220, 0.12); padding: 1em 1.25em' } });
const monthlyOuterHeader = monthlyOuter.createEl('div', { attr: { style: HEADER_STYLE } });
monthlyOuterHeader.createEl('div', { text: 'Monthly View', attr: { style: TITLE_STYLE } });
const monthNav           = monthlyOuterHeader.createEl('div');
const dayInfoEl          = monthlyOuter.createEl('div', { attr: { style: 'font-size:0.8em;color:var(--text-muted);margin:-0.25em 0 0.75em;text-align:right;display:none' } });

// Inner: Snapshot
const snapshotSection = monthlyOuter.createEl('div', { cls: 'budget-section', attr: { style: 'background: rgba(100, 140, 220, 0.18)' } });
snapshotSection.createEl('div', { attr: { style: INNER_HEADER_STYLE } })
  .createEl('span', { text: 'Snapshot', attr: { style: INNER_TITLE_STYLE } });
const monthContent    = snapshotSection.createEl('div');

// Inner: Repeating Monthly Commitments
const commitSection   = monthlyOuter.createEl('div', { cls: 'budget-section', attr: { style: 'background: rgba(160, 100, 220, 0.18)' } });
commitSection.createEl('div', { attr: { style: INNER_HEADER_STYLE } })
  .createEl('span', { text: 'Planned Fixed Costs', attr: { style: INNER_TITLE_STYLE } });
const commitContent   = commitSection.createEl('div');

// Annual
const annualOuter       = root.createEl('div', { cls: 'budget-section', attr: { style: 'background: rgba(60, 180, 130, 0.12); padding: 1em 1.25em' } });
const annualOuterHeader = annualOuter.createEl('div', { attr: { style: HEADER_STYLE } });
annualOuterHeader.createEl('div', { text: 'Annual View', attr: { style: TITLE_STYLE } });
const annualNav         = annualOuterHeader.createEl('div');
const annualInner       = annualOuter.createEl('div', { cls: 'budget-section', attr: { style: 'background: rgba(60, 180, 130, 0.18)' } });
annualInner.createEl('div', { attr: { style: INNER_HEADER_STYLE } })
  .createEl('span', { text: 'Summary', attr: { style: INNER_TITLE_STYLE } });
const annualContent     = annualInner.createEl('div');

async function refreshAnnual() {
  const records = await loadYear(state.annualYear);
  annualNav.empty();
  renderNavBar(annualNav, String(state.annualYear),
    () => { state.annualYear--; refreshAnnual(); },
    () => { state.annualYear++; refreshAnnual(); }
  );
  renderAnnual(annualContent, records, state.annualYear);
}

async function refreshMonth() {
  const records = await loadYear(state.monthYear);
  monthNav.empty();
  renderNavBar(monthNav, `${MONTH_NAMES[state.month]} ${state.monthYear}`,
    () => {
      state.month--;
      if (state.month < 0) { state.month = 11; state.monthYear--; }
      refreshMonth();
    },
    () => {
      state.month++;
      if (state.month > 11) { state.month = 0; state.monthYear++; }
      refreshMonth();
    }
  );
  renderMonth(monthContent, dayInfoEl, records, state.monthYear, state.month);
  commitContent.empty();
  renderCommitmentsTable(commitContent, records, state.monthYear);
}

await refreshAnnual();
await refreshMonth();
```
