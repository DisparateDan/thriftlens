# ThriftLens

A personal cashflow dashboard for people who want to understand where their money goes, and see their cost of living.

---

## Philosophy

I built ThriftLens for my own needs, to track and understand where my money goes. The question I want ThriftLens to answer, at any point in the year, is: *what does my cost of living actually look like right now?* What's locked in, what's budgeted/expected, what has cleared — all in one view, without manual reconciliation.

The app is idiosyncratic - I aimed for simplicity and glance-view clarity over 'correct' accounting models. But perhaps you'll find it useful!

**Money is committed before it is spent.** I want to see costs in advance. Insurance premiums are due every year. Rent is owed on the first of every month whether I've paid it or not. Heating oil will be needed in October whether I've budgeted for it or not. Cost of a holiday earmarked for summer is, in effect, already gone. I want my financial picture to reflect that abstraction — not wait for the bank statement to confirm it.

Some costs are only approximately known in advance — so the app earmarks a figure, drawn from what I actually spent on that category last year (you'll have estimate amounts yourself for the first year). That reservation shows up in the dashboard immediately because that's the honest picture. Estimates are forward commitments of things I know I'll have to spend on.

Apart from the estimated spends, I'm not budgeting or setting aside pots of money here. The app is fatalistic and just assumes life is expense. Unplanned spending simply appears as actual spend records. The dashboard shows me what it cost; I draw my own conclusions.

---

## Mental Model

Every entry in ThriftLens is one of three things:

**Planned Known** — a recurring cost whose amount you already know with certainty. Rent, a phone contract, a known insurance premium. These are commitments: the money is as good as spent the moment the period begins.

**Planned Estimate** — money earmarked for something whose exact cost isn't yet determined. Heating oil for the winter, property tax before the bill arrives, a holiday budget, a home improvement project. You know roughly what it will cost and you are treating that money as spoken for. Once the actual bill comes and you pay it, the actual spend is recorded alongside — the estimate remains as the budget benchmark.

**Actual Spend** — a real transaction that has occurred. This may realise a planned expense (paying the heating oil bill) or be entirely ad hoc (an unplanned repair, a dinner out). Actual spend records are always taken at face value — no scaling applied.

### The two views

**Monthly view** shows the current month: what is committed this month (planned known and planned estimate entries, amortised to a monthly figure), and what has actually been spent so far. It gives you a running picture of the month — how much is locked in, how much is paid, how much remains to clear.

**Annual view** shows the full year: the total committed baseline versus total actual spend, broken down by category. This is where you see whether your annual estimates are holding, whether one-off projects are coming in on budget, and how the year is tracking overall.

### Periodicity and amortisation

Logged entries carry a `periodicity` of either `monthly` or `annual`. This is not just metadata — it changes how the amount is interpreted:

| Periodicity | Monthly view | Annual view |
|---|---|---|
| `monthly` | amount as-is | amount × months active in year |
| `annual` | amount ÷ 12 | amount as-is |

A monthly rent of €1,575 shows as €1,575 in the monthly view and €18,900 annualised. A €2,500 heating oil estimate shows as ~€208/month and €2,500 for the year. Actual spend records are never multiplied — they are point-in-time facts.

### Spend categories

Every entry carries a `spend_category` slug (e.g. `rent`, `heating_oil`, `property_tax`). This is the join key that connects planned and actual records for the same cost. It enables the dashboard to:

- Show actual spend for a category against its planned budget
- Pre-fill next year's `planned_known annual` amounts from this year's actuals
- Group and subtotal meaningfully without fuzzy description matching

---

## Data Model

### Registers

Data lives in one Markdown file per year — called a **register** — stored in the vault's `thriftLens/` folder:

```
thriftLens/
  2024.md
  2025.md
  2026.md
```

Each register has a small frontmatter block identifying it, then a single fenced YAML block containing all entries for the year:

```markdown
---
tl_type: register
year: 2026
---

\```yaml
- date: 2026-01-01
  amount: 1575
  spend_type: planned_known
  periodicity: monthly
  spend_category: rent
  description: Rent

- date: 2026-03-12
  amount: 94.80
  spend_type: actual_spend
  periodicity: monthly
  spend_category: groceries
  description: Groceries
\```
```

### Entry schema

| Field | Type | Values |
|---|---|---|
| `date` | `YYYY-MM-DD` | Entry date; for planned entries, the start of the period |
| `amount` | number | No currency symbol; never negative |
| `spend_type` | string | `planned_known` · `planned_estimate` · `actual_spend` |
| `periodicity` | string | `monthly` · `annual` |
| `spend_category` | string | Short slug, e.g. `heating_oil`, `rent` |
| `description` | string | Free text |
| `valid_until` | `YYYY-MM-DD` | Optional; planned entries only; marks a mid-year expiry |

### Carry-forward rules

At year-end, next year's register is built from the current one:

| Entry type | Carry-forward behaviour |
|---|---|
| `planned_known` + `monthly` | Carried over unchanged |
| `planned_known` + `annual` | Amount pre-filled from the total actual spend for that category this year |
| `planned_estimate` | Always entered explicitly; never carried over automatically |

The Plan next year command presents a review step before writing anything. You adjust amounts, delete entries that no longer apply, add new ones, then confirm. Nothing is written until you do.

---

## Structure

```
thriftlens/
├── vault/                        Obsidian vault root
│   ├── thriftLens/               Register files (YYYY.md)
│   ├── dashboards/               DataviewJS prototype dashboard
│   └── .obsidian/
│       └── plugins/thriftlens/   Built plugin output
└── plugin/                       Plugin source (TypeScript + esbuild)
    └── src/
        ├── main.ts
        ├── logic.ts              Pure business logic — no Obsidian imports
        ├── parser.ts             YAML block parsing and serialisation
        ├── loader.ts             Vault file reading
        ├── renderer.ts           DOM rendering
        ├── ThriftLensView.ts     ItemView subclass
        ├── settings.ts
        └── modals/
            ├── AddEntryModal.ts
            ├── CarryForwardModal.ts
            └── CreateRecordModal.ts
```

---

## Using ThriftLens

Install ThriftLens like any Obsidian community plugin, then click the hand-coins icon in the ribbon to open the dashboard.

### Commands

**Log an expense** — opens a form to record a new entry in the current year's register. Fields: date, amount, spend type, periodicity, spend category, description.

**New register** — creates a fresh register file for a given year, ready to receive entries.

**Import from CSV** — imports entries from a CSV file into the appropriate year's register (creating the register if it doesn't exist yet). Columns: `date`, `amount`, `spend_type`, `periodicity`, `spend_category`, `description`, and optionally `valid_until`. Actual spend rows are always appended; planned entries are skipped if an entry with the same category and periodicity already exists, to avoid duplicates. After importing, a summary shows how many entries were added, how many were skipped, and any rows that couldn't be parsed.

**Plan next year** — opens a review screen showing a proposed set of entries for the coming year, built from your current year's data. Monthly known costs carry over as-is; annual costs are pre-filled from what you actually spent this year. You can adjust amounts, remove entries that no longer apply, and add new ones. Nothing is written until you confirm.

### Settings

| Setting | Default | Description |
|---|---|---|
| Currency symbol | `€` | Displayed in the dashboard; not stored in data files |
| Data folder | `thriftLens` | Folder within the vault containing register files |
| Default view | `monthly` | Which tab opens when the dashboard is first shown |

---

## Development

The plugin is built with TypeScript and esbuild. The source is in `plugin/`; the output lands in `vault/.obsidian/plugins/thriftlens/`.

```bash
cd plugin
npm install
npm run dev      # watch mode with sourcemaps
npm run build    # production build
npm run typecheck
```

The core business logic in `logic.ts` has no Obsidian imports and can be tested independently. The Dataview prototype in `vault/dashboards/` was how the UX and logic were validated before the plugin was written; the functions migrated across unchanged.
