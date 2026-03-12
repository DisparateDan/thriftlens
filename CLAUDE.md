# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An Obsidian vault for personal financial budgeting using DataviewJS dashboards that query structured markdown data files.

Don't show me any code diffs or code output in the chat stream. I'll check them myself if I want to see.

## Data Model

### Budget Record Files

- Location: `finances/budget/<year>.md` (one file per year)
- Records stored as a YAML list under the `records` key in frontmatter

```yaml
---
budget_record: true
year: 2025
records:
  - date: 2025-01-05
    amount: 94.80
    kind: spend
    category: monthly_estimated
    description: Groceries
---
```

### Record Schema

| Field | Values |
|-------|--------|
| `date` | `YYYY-MM-DD` |
| `amount` | numeric (no currency symbol) |
| `kind` | `repeating` \| `committed` \| `spend` |
| `category` | `epic` \| `fixed_annual` \| `monthly_fixed` \| `monthly_estimated` |
| `description` | free text |
| `valid_until` | `YYYY-MM-DD` or omitted |

### kind semantics

- **repeating** — automatic recurring cost, known amount (rent, phone, insurance premium)
- **committed** — earmarked cost, estimated amount, amortised across the year (heating oil, property tax, holiday, epic projects); money is spoken for even if not yet paid
- **spend** — actual recorded transaction; `valid_until` omitted

Both `repeating` and `committed` form the committed baseline. Together with `spend` they give the full cost picture. There is no discretionary budget concept — unplanned spend simply appears in `spend` records only.

### Amount interpretation by cost_category

`budget` and `repeating` records follow the same rule:

| cost_category | Amount means | Annualised as |
|---|---|---|
| `monthly_fixed` | monthly amount | `amount × months_active_in_year` |
| `monthly_estimated` | monthly amount | `amount × months_active_in_year` |
| `fixed_annual` | full annual amount | `amount` (amortised to `amount ÷ 12` per month) |
| `epic` | total project budget | `amount` (lump sum, not spread) |

`spend` records are always taken at face value — no multiplication.

A `spend` record for an annual payment coexists with the `repeating,fixed_annual` record: the repeating record drives the amortised budget view; the spend record tracks the real cash outflow.

### cat semantics

- **epic** — large one-off projects (renovation, holiday)
- **fixed_annual** — annual fixed costs (insurance, yearly subscriptions)
- **monthly_fixed** — predictable monthly costs (rent, phone)
- **monthly_estimated** — committed but variable-amount monthly costs (utilities, heating); ad hoc spend like groceries appears only as `spend` records with no planned counterpart

## Dashboard Files

DataviewJS dashboards live at `finances/dashboards/`. Records are read directly from frontmatter — no parsing needed:

```js
const page = dv.pages('"finances/budget"').where(p => p.budget_record && p.year === year).first();
const records = page.records; // already a JS array from YAML
```

Dataview parses YAML dates as Luxon DateTime objects — normalise to JS Date via `val.toJSDate()`.

## Plugin Migration Path

The long-term goal is to extract the dashboards into a standalone Obsidian plugin, leaving only data files (`budget/*.md`) in the vault.

**Design rule**: DataviewJS blocks must be thin wrappers. All parsing, aggregation, and budget logic lives in plain JS functions defined at the top of the block (or in a shared helper file). These functions have no dependency on DataviewJS APIs — only the file-reading and rendering calls touch `dv.*`.

This means migration is a two-step swap:
1. Replace `dv.pages(...)` file reading → `app.vault` + `app.metadataCache`
2. Replace `dv.table(...)` rendering → Obsidian `ItemView` DOM / Markdown rendering

The core logic functions move unchanged.

Plugin stack when ready: TypeScript, esbuild, `obsidian` npm package (types + API).
