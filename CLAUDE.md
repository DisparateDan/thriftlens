# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ThriftLens** — an Obsidian vault for personal cashflow dashboarding using DataviewJS dashboards that query structured markdown data files.

Don't show me any code diffs or code output in the chat stream. I'll check them myself if I want to see.

## Data Model

### Budget Record Files

- Location: `vault/budget/<year>.md` (one file per year)
- Records stored as a YAML fenced block in the file body (not frontmatter)
- Frontmatter identifies the file type and year

```yaml
---
tl_type: register
year: 2025
---
```

```yaml
- date: 2025-01-05
  amount: 94.80
  spend_type: spend
  periodicity: monthly
  description: Groceries
```

### Record Schema

| Field | Values |
|-------|--------|
| `date` | `YYYY-MM-DD` |
| `amount` | numeric (no currency symbol) |
| `spend_type` | `planned_known` \| `planned_estimate` \| `actual_spend` |
| `periodicity` | `monthly` \| `annual` |
| `description` | free text |
| `valid_until` | `YYYY-MM-DD` (omitted by default; only present for mid-year expiry) |
| `spend_category` | short slug grouping related records across spend types (e.g. `heating_oil`, `rent`) |

### spend_type semantics

- **planned_known** — recurring cost with a known amount (rent, phone, insurance premium)
- **planned_estimate** — earmarked cost with an estimated amount (heating oil, property tax, holiday, projects); money is spoken for even if not yet paid
- **actual_spend** — actual recorded transaction (whether realising a planned expense or genuinely ad-hoc); `valid_until` omitted

Both `planned_known` and `planned_estimate` form the planned baseline. Together with `actual_spend` they give the full cost picture. There is no discretionary budget concept — ad hoc spend simply appears as `actual_spend` records only.

### Amount interpretation by periodicity

`repeating` and `committed` records follow the same rule:

| periodicity | Amount means | Monthly view | Annual view |
|---|---|---|---|
| `monthly` | monthly amount | `amount` | `amount × months_active_in_year` |
| `annual` | full annual amount | `amount ÷ 12` | `amount` |

`spend` records are always taken at face value — no multiplication.

An annual `actual_spend` record coexists with its `planned_known,annual` counterpart: the planned record drives the amortised committed view; the actual_spend record tracks the real cash outflow. They share the same `spend_category`.

### periodicity semantics

- **monthly** — costs that recur every month (rent, phone, utilities, groceries)
- **annual** — everything else: taxes, insurance, fuel, holidays, repairs, one-off projects

### spend_category

Every record carries a `spend_category` slug (e.g. `heating_oil`, `rent`, `groceries`). This enables grouping and comparison across spend types without fuzzy description matching:

- Actual spend for a category: sum `actual_spend` records with that `spend_category`
- Budget for a category: the `planned_estimate` or `planned_known` record with the same `spend_category`
- Carry-forward: annual `planned_known` records are seeded from the prior year's `actual_spend` total for the same `spend_category`

### Carry-forward behaviour

| spend_type + periodicity | New year behaviour |
|---|---|
| `planned_known` + `monthly` | Clone record into new year's file as-is |
| `planned_known` + `annual` | Create new record; seed amount from prior year's `actual_spend` total for same `spend_category` |
| `planned_estimate` | Always entered explicitly; never auto-carried |

## Dashboard Files

DataviewJS dashboards live at `vault/dashboards/`. Records are parsed from the YAML fenced block in the file body:

```js
const page = dv.pages('"budget"').where(p => p.tl_type === 'record' && p.year === year).first();
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
