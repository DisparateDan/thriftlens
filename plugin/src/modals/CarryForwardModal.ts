import { App, Modal, Notice, Setting, normalizePath } from 'obsidian';
import type ThriftLensPlugin from '../main';
import type { BudgetEntry } from '../types';
import { loadYear } from '../loader';
import { serialiseEntry } from '../parser';

interface ProposedEntry extends BudgetEntry {
  origin:        string;
  discretionary: boolean;
}

export class CarryForwardModal extends Modal {
  private plugin:      ThriftLensPlugin;
  private sourceYear:  number;
  private targetYear:  number;
  private proposed:    ProposedEntry[] = [];
  private listEl!:     HTMLElement;
  private confirmBtn!: HTMLButtonElement;

  constructor(app: App, plugin: ThriftLensPlugin) {
    super(app);
    this.plugin     = plugin;
    this.sourceYear = new Date().getFullYear();
    this.targetYear = this.sourceYear + 1;
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('tl-carry-modal');
    contentEl.createEl('h2', { text: `Carry Forward: ${this.sourceYear} → ${this.targetYear}` });

    const loading = contentEl.createEl('p', { text: 'Loading source records…' });
    const sourceRecords = await loadYear(this.app, this.plugin.settings.dataFolder, this.sourceYear);
    loading.remove();

    this.proposed = this.buildProposal(sourceRecords);
    this.renderBody(contentEl);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  // ── Proposal builder ────────────────────────────────────────

  private buildProposal(sourceRecords: BudgetEntry[]): ProposedEntry[] {
    const actualsByCat: Record<string, number> = {};
    sourceRecords
      .filter(r => r.spend_type === 'actual_spend')
      .forEach(r => {
        actualsByCat[r.spend_category] = (actualsByCat[r.spend_category] || 0) + r.amount;
      });

    const jan1 = new Date(this.targetYear, 0, 1);
    const proposed: ProposedEntry[] = [];

    for (const r of sourceRecords) {
      if (r.spend_type === 'planned_known' && r.periodicity === 'monthly') {
        proposed.push({
          ...r, date: jan1, valid_until: null,
          origin: `carried from ${this.sourceYear}`,
          discretionary: false,
        });

      } else if (r.spend_type === 'planned_known' && r.periodicity === 'annual') {
        const hasActuals = r.spend_category in actualsByCat;
        proposed.push({
          ...r, date: jan1, valid_until: null,
          amount: hasActuals ? actualsByCat[r.spend_category] : r.amount,
          origin: hasActuals
            ? `seeded from ${this.sourceYear} actuals`
            : `carried from ${this.sourceYear} (no actuals found)`,
          discretionary: false,
        });

      } else if (r.spend_type === 'planned_estimate') {
        proposed.push({
          ...r, date: jan1, valid_until: null,
          origin: `discretionary — review before keeping`,
          discretionary: true,
        });
      }
    }

    return proposed;
  }

  // ── Rendering ───────────────────────────────────────────────

  private renderBody(contentEl: HTMLElement): void {
    const targetPath = normalizePath(`${this.plugin.settings.dataFolder}/${this.targetYear}.md`);
    if (this.app.vault.getFileByPath(targetPath)) {
      contentEl.createEl('p', {
        text: `⚠ A record for ${this.targetYear} already exists. Confirming will overwrite it.`,
        cls: 'tl-carry-warn',
      });
    }

    contentEl.createEl('p', {
      text: `Review the proposed entries for ${this.targetYear}. Edit amounts, delete unwanted entries, then confirm.`,
      cls: 'tl-carry-intro',
    });

    this.listEl = contentEl.createEl('div', { cls: 'tl-carry-list' });
    this.renderList();

    contentEl.createEl('button', { text: '+ Add entry', cls: 'tl-carry-add-btn' })
      .addEventListener('click', () => this.addBlankEntry());

    new Setting(contentEl)
      .addButton(b => b
        .setButtonText('Cancel')
        .onClick(() => this.close()))
      .addButton(b => {
        b.setButtonText('Confirm & Write').setCta().onClick(() => this.confirm());
        this.confirmBtn = b.buttonEl;
      });
  }

  private renderList(): void {
    this.listEl.empty();
    this.proposed.forEach((entry, idx) => {
      const row = this.listEl.createEl('div', {
        cls: `tl-carry-row${entry.discretionary ? ' tl-carry-row--discretionary' : ''}`,
      });

      const info = row.createEl('div', { cls: 'tl-carry-info' });
      info.createEl('span', { text: entry.description || '(no description)', cls: 'tl-carry-desc' });
      info.createEl('span', { text: entry.origin, cls: 'tl-carry-origin' });

      const controls = row.createEl('div', { cls: 'tl-carry-controls' });
      const amountInput = controls.createEl('input', { cls: 'tl-carry-amount' }) as HTMLInputElement;
      amountInput.type  = 'number';
      amountInput.value = String(entry.amount);
      amountInput.step  = '0.01';
      amountInput.addEventListener('change', () => {
        this.proposed[idx].amount = parseFloat(amountInput.value) || 0;
      });

      controls.createEl('button', { text: '✕', cls: 'tl-carry-del-btn' })
        .addEventListener('click', () => {
          this.proposed.splice(idx, 1);
          this.renderList();
        });
    });
  }

  private addBlankEntry(): void {
    this.proposed.push({
      date: new Date(this.targetYear, 0, 1),
      amount: 0,
      spend_type:     'planned_known',
      periodicity:    'monthly',
      description:    '',
      spend_category: '',
      valid_until:    null,
      origin:         'new entry',
      discretionary:  false,
    });
    this.renderList();
  }

  // ── Confirm ──────────────────────────────────────────────────

  private async confirm(): Promise<void> {
    for (const e of this.proposed) {
      if (!e.spend_category.trim() || !e.description.trim()) {
        new Notice('All entries must have a spend_category and description');
        return;
      }
    }

    // Group by spend_type for canonical section ordering
    const sections: Record<string, BudgetEntry[]> = {
      planned_estimate: [],
      planned_known:    [],
      actual_spend:     [],
    };
    for (const e of this.proposed) {
      sections[e.spend_type].push(e);
    }

    const yamlLines: string[] = [
      '# ── Planned estimate ──────────────────────────────',
      ...sections['planned_estimate'].map(e => serialiseEntry(e)),
      '',
      '# ── Planned known ─────────────────────────────────',
      ...sections['planned_known'].map(e => serialiseEntry(e)),
      '',
      '# ── Actual spend ──────────────────────────────────',
    ];

    const content = [
      '---',
      'tl_type: record',
      `year: ${this.targetYear}`,
      '---',
      '',
      '```yaml',
      yamlLines.join('\n'),
      '```',
      '',
    ].join('\n');

    await this.plugin.ensureDataFolder();

    const path    = normalizePath(`${this.plugin.settings.dataFolder}/${this.targetYear}.md`);
    const existing = this.app.vault.getFileByPath(path);

    if (existing) {
      await this.app.vault.process(existing, () => content);
    } else {
      await this.app.vault.create(path, content);
    }

    new Notice(`Record for ${this.targetYear} written`);
    this.close();
  }
}
