import { ItemView, WorkspaceLeaf, normalizePath } from 'obsidian';
import type ThriftLensPlugin from './main';
import { loadYear } from './loader';
import type { BudgetEntry } from './types';
import { MONTH_NAMES } from './logic';
import {
  renderNavBar, renderSummaryCards, renderCommitmentsTable,
  renderMonth, renderAnnual,
} from './renderer';
import { AddEntryModal } from './modals/AddEntryModal';

export const VIEW_TYPE = 'thriftlens-dashboard';

interface ViewState {
  year:       number;
  month:      number;
  annualYear: number;
  activeTab:  'monthly' | 'annual';
}

export class ThriftLensView extends ItemView {
  private plugin: ThriftLensPlugin;
  private state: ViewState;
  private refreshing = false;

  // DOM refs set in onOpen
  private monthTabBtn!:       HTMLElement;
  private annualTabBtn!:      HTMLElement;
  private monthNav!:          HTMLElement;
  private annualNav!:         HTMLElement;
  private monthlyOuter!:      HTMLElement;
  private annualOuter!:       HTMLElement;
  private dayInfoEl!:         HTMLElement;
  private cardsContent!:      HTMLElement;
  private commitContent!:     HTMLElement;
  private spendContent!:      HTMLElement;
  private annualBlueContent!: HTMLElement;
  private annualPurpleContent!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: ThriftLensPlugin) {
    super(leaf);
    this.plugin = plugin;
    const now = new Date();
    this.state = {
      year:       now.getFullYear(),
      month:      now.getMonth(),
      annualYear: now.getFullYear(),
      activeTab:  plugin.settings.defaultView,
    };
  }

  getViewType():    string { return VIEW_TYPE; }
  getDisplayText(): string { return 'ThriftLens'; }
  getIcon():        string { return 'wallet'; }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass('tl-dashboard');

    // ── Toolbar ───────────────────────────────────────────────
    const toolbar  = root.createEl('div', { cls: 'tl-toolbar' });
    const tabGroup = toolbar.createEl('div', { cls: 'tl-tab-group' });
    this.monthTabBtn  = tabGroup.createEl('button', { text: 'Monthly', cls: 'tl-tab-btn' });
    this.annualTabBtn = tabGroup.createEl('button', { text: 'Annual',  cls: 'tl-tab-btn' });
    toolbar.createEl('div', { cls: 'tl-sep' });
    this.monthNav  = toolbar.createEl('div', { cls: 'tl-nav-slot' });
    this.annualNav = toolbar.createEl('div', { cls: 'tl-nav-slot' });
    toolbar.createEl('div', { cls: 'tl-spacer' });
    const addBtn   = toolbar.createEl('button', { text: '+ Entry',  cls: 'tl-add-btn' });
    const todayBtn = toolbar.createEl('button', { text: 'Today',    cls: 'tl-today-btn' });

    // ── Monthly outer ──────────────────────────────────────────
    this.monthlyOuter = root.createEl('div', { cls: 'tl-tab-pane' });
    this.dayInfoEl    = this.monthlyOuter.createEl('div', { cls: 'tl-day-info' });
    this.dayInfoEl.style.display = 'none';

    const commitSection = this.monthlyOuter.createEl('div', { cls: 'tl-section tl-section--blue' });
    commitSection.createEl('div', { cls: 'tl-section-header' })
      .createEl('span', { text: 'Summary', cls: 'tl-section-title' });
    this.cardsContent = commitSection.createEl('div');
    commitSection.createEl('div', { text: 'Fixed Costs Detail', cls: 'tl-subsection-label' });
    this.commitContent = commitSection.createEl('div');

    const spendSection = this.monthlyOuter.createEl('div', { cls: 'tl-section tl-section--purple' });
    spendSection.createEl('div', { cls: 'tl-section-header' })
      .createEl('span', { text: 'Transactions', cls: 'tl-section-title' });
    this.spendContent = spendSection.createEl('div');

    // ── Annual outer ───────────────────────────────────────────
    this.annualOuter = root.createEl('div', { cls: 'tl-tab-pane' });

    const annualBlueSection = this.annualOuter.createEl('div', { cls: 'tl-section tl-section--blue' });
    annualBlueSection.createEl('div', { cls: 'tl-section-header' })
      .createEl('span', { text: 'Summary', cls: 'tl-section-title' });
    this.annualBlueContent = annualBlueSection.createEl('div');

    const annualPurpleSection = this.annualOuter.createEl('div', { cls: 'tl-section tl-section--purple' });
    annualPurpleSection.createEl('div', { cls: 'tl-section-header' })
      .createEl('span', { text: 'Planned Fixed Costs', cls: 'tl-section-title' });
    this.annualPurpleContent = annualPurpleSection.createEl('div');

    // ── Event wiring ───────────────────────────────────────────
    this.monthTabBtn.onclick  = () => this.showTab('monthly');
    this.annualTabBtn.onclick = () => this.showTab('annual');

    addBtn.onclick = () => new AddEntryModal(this.app, this.plugin).open();

    todayBtn.onclick = () => {
      const now = new Date();
      this.state.year  = now.getFullYear();
      this.state.month = now.getMonth();
      this.showTab('monthly');
      this.refresh();
    };

    // Refresh when any file in the data folder changes
    const dataPath = normalizePath(this.plugin.settings.dataFolder);
    this.registerEvent(
      this.app.vault.on('modify', file => {
        if (file.path.startsWith(dataPath)) this.refresh();
      }),
    );

    this.showTab(this.state.activeTab);
    await this.refresh();
  }

  async onClose(): Promise<void> {
    // registerEvent cleans up listeners automatically
  }

  private showTab(tab: 'monthly' | 'annual'): void {
    this.state.activeTab = tab;
    this.monthlyOuter.style.display = tab === 'monthly' ? '' : 'none';
    this.annualOuter.style.display  = tab === 'annual'  ? '' : 'none';
    this.monthNav.style.display     = tab === 'monthly' ? 'flex' : 'none';
    this.annualNav.style.display    = tab === 'annual'  ? 'flex' : 'none';
    this.monthTabBtn.toggleClass('tl-tab-btn--active',  tab === 'monthly');
    this.annualTabBtn.toggleClass('tl-tab-btn--active', tab === 'annual');
  }

  async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const { year, month, annualYear } = this.state;
      const currency = this.plugin.settings.currencySymbol;
      const folder   = this.plugin.settings.dataFolder;

      // Load with simple dedup when both tabs are on the same year
      const cache = new Map<number, BudgetEntry[]>();
      const load  = async (y: number): Promise<BudgetEntry[]> => {
        if (!cache.has(y)) cache.set(y, await loadYear(this.app, folder, y));
        return cache.get(y)!;
      };
      const [monthRecords, annualRecords] = await Promise.all([load(year), load(annualYear)]);

      // Monthly nav
      this.monthNav.empty();
      renderNavBar(
        this.monthNav,
        `${MONTH_NAMES[month]} ${year}`,
        () => {
          this.state.month--;
          if (this.state.month < 0) { this.state.month = 11; this.state.year--; }
          this.refresh();
        },
        () => {
          this.state.month++;
          if (this.state.month > 11) { this.state.month = 0; this.state.year++; }
          this.refresh();
        },
      );

      // Annual nav
      this.annualNav.empty();
      renderNavBar(
        this.annualNav,
        String(annualYear),
        () => { this.state.annualYear--; this.refresh(); },
        () => { this.state.annualYear++; this.refresh(); },
      );

      renderMonth(
        this.cardsContent, this.spendContent, this.dayInfoEl,
        monthRecords, year, month, currency,
      );
      this.commitContent.empty();
      renderCommitmentsTable(this.commitContent, monthRecords, year, currency);

      renderAnnual(
        this.annualBlueContent, this.annualPurpleContent,
        annualRecords, annualYear, currency,
      );
    } finally {
      this.refreshing = false;
    }
  }
}
