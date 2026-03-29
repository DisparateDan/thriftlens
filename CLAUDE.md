# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ThriftLens** — a standalone Obsidian plugin for personal cashflow dashboarding. Data lives in structured markdown files; the plugin reads, renders, and manages them via the Obsidian vault API.

Don't show me any code diffs or code output in the chat stream. I'll check them myself if I want to see.

Don't modify real data files at `/home/dan/Obsidian/PersonalDB/thriftLens/` unless explicitly asked. Analyse, but don't touch.

## Data Model

### Register Files

- Location: `thriftLens/<year>.md` (one file per year, within the configured data folder)
- Records stored as a YAML fenced block in the file body (not frontmatter)
- Frontmatter identifies the file type and year

```yaml
---
tl_type: register
year: 2026
---
```

### Record Schema

| Field | Values |
|-------|--------|
| `date` | `YYYY-MM-DD` — transaction date for `actual_spend`; conventionally `YYYY-01-01` for plan entries |
| `amount` | numeric (no currency symbol) — monthly amount for `monthly_fixed`; full-year amount for `annual_estimate` |
| `spend_type` | `monthly_fixed` \| `annual_estimate` \| `actual_spend` |
| `spend_category` | short slug grouping related records (e.g. `heating`, `rent`, `driving`) |
| `description` | free text label |
| `valid_until` | `YYYY-MM-DD` — optional; `monthly_fixed` only; marks a mid-year expiry |

### spend_type semantics

- **monthly_fixed** — recurring cost with a known fixed monthly amount (rent, phone, broadband). `valid_until` may be set for mid-year expiry. No `periodicity` field.
- **annual_estimate** — money earmarked for something with an estimated annual cost (heating oil, insurance, holidays, projects). Amount is the full-year figure. No `periodicity` field.
- **actual_spend** — a real recorded transaction, whether it realises a planned expense or is entirely ad hoc. Always taken at face value; no scaling applied.

### Amount interpretation

| spend_type | Monthly view | Annual view |
|---|---|---|
| `monthly_fixed` | amount as-is | amount × months active in year |
| `annual_estimate` | amount ÷ 12 | amount as-is |
| `actual_spend` | face value | face value |

Monthly fixed spend-to-date is computed as `amount × months_elapsed` — no actual transaction matching needed.

### spend_category

Every record carries a `spend_category` slug. This is the join key between planned and actual records:

- Multiple plan records can share a `spend_category` to form a bucket (e.g. several `driving` costs). The annual view shows a combined total with an expandable row.
- `annual_estimate` actuals are matched by `spend_category` to compute spend-to-date.
- Carry-forward seeds `annual_estimate` amounts from the prior year's `actual_spend` total for the same `spend_category`.
- Choose slugs by **planning behaviour**, not real-world meaning. A fixed monthly coffee subscription belongs in `subscriptions`, not `groceries`, if you want grocery actuals to appear as unplanned.
- **A slug used by any plan entry absorbs all actuals under that slug into planned tracking.** Those actuals will not appear in the unplanned averages section. If an `actual_spend` category shares a slug with a `monthly_fixed` or `annual_estimate`, give it its own slug to keep it in unplanned tracking. The UI shows a warning when absorbed actuals are detected.

### Carry-forward behaviour

| spend_type | New year behaviour |
|---|---|
| `monthly_fixed` | Cloned into new year as-is (date = Jan 1, valid_until cleared) |
| `annual_estimate` | Amount seeded from prior year's `actual_spend` total for same `spend_category`; falls back to source amount if no actuals found |
| `actual_spend` | Never carried forward |

## Plugin Architecture

The plugin is a TypeScript/esbuild Obsidian plugin. Source in `plugin/src/`, output deployed to the vault's `.obsidian/plugins/thriftlens/`.

### Key source files

| File | Role |
|---|---|
| `main.ts` | Plugin entry point, command registration |
| `ThriftLensView.ts` | ItemView subclass — three-tab dashboard (Monthly, Annual, Year on Year) |
| `logic.ts` | Pure business logic — no Obsidian imports; fully unit-tested |
| `parser.ts` | YAML block parsing and entry serialisation |
| `loader.ts` | Vault file reading via Obsidian API |
| `renderer.ts` | DOM rendering for all three views |
| `exporter.ts` | Self-contained HTML report generation |
| `carryForward.ts` | Carry-forward proposal logic |
| `csvUtils.ts` | Shared CSV parsing/serialisation utilities |
| `settings.ts` | Plugin settings (currency symbol, data folder, default view) |
| `modals/AddEntryModal.ts` | Log an expense — date in DD-MM-YYYY for actuals; year only for plan entries |
| `modals/CarryForwardModal.ts` | Plan next year — review and confirm carry-forward proposal |
| `modals/CreateRecordModal.ts` | Create a new year register |
| `modals/ImportCsvModal.ts` | Bulk import from CSV |
| `modals/ExportCsvModal.ts` | Export register to CSV |

### Build and deploy

Run from `plugin/`:

```bash
npm run build    # production build
npm run dev      # watch mode
npm run deploy   # build + copy to dev vault
npm run test     # Vitest unit tests
```

Default deploy target is the **dev vault** (`vault/`). Deploy to the real vault (`~/Obsidian/PersonalDB`) only when explicitly asked, using `./deploy-to-real-vault.sh thriftlens` from the repo root.

**Always bump `manifest.json` version before deploying a material change** — this is how the user verifies Obsidian picked up the new build.

## Testing

Unit tests live in `plugin/tests/`. Fixture registers for integration tests are in `plugin/tests/fixtures/`. Run with `npm run test` (requires Node v20+ via nvm).

Test files:
- `logic.test.ts` — pure logic functions
- `parser.test.ts` — YAML parsing and serialisation roundtrip
- `carryForward.test.ts` — carry-forward proposal rules
- `csvUtils.test.ts` — CSV parsing and serialisation
- `integration.test.ts` — full parse→compute pipeline using fixture files
