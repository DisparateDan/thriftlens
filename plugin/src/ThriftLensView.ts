import { ItemView, WorkspaceLeaf, normalizePath, setIcon, TFile } from 'obsidian';
import type ThriftLensPlugin from './main';
import { loadYear, yearFileExists, getAvailableYears } from './loader';
import type { BudgetEntry } from './types';
import { MONTH_NAMES } from './logic';
import {
  renderNavBar, renderSummaryCards, renderCommitmentsTable,
  renderMonth, renderAnnual, renderYoY,
} from './renderer';
import { AddEntryModal }     from './modals/AddEntryModal';
import { CreateRecordModal } from './modals/CreateRecordModal';

export const VIEW_TYPE = 'thriftlens-dashboard';

interface ViewState {
  year:       number;
  month:      number;
  annualYear: number;
  activeTab:  'monthly' | 'annual' | 'yoy';
}

export class ThriftLensView extends ItemView {
  private plugin: ThriftLensPlugin;
  private state: ViewState;
  private refreshing = false;

  // DOM refs set in onOpen
  private monthTabBtn!:       HTMLElement;
  private annualTabBtn!:      HTMLElement;
  private yoyTabBtn!:         HTMLElement;
  private monthNav!:          HTMLElement;
  private annualNav!:         HTMLElement;
  private monthlyOuter!:      HTMLElement;
  private annualOuter!:       HTMLElement;
  private yoyOuter!:          HTMLElement;
  private yoyContent!:        HTMLElement;
  private dayInfoEl!:         HTMLElement;
  private cardsContent!:      HTMLElement;
  private commitContent!:     HTMLElement;
  private spendContent!:      HTMLElement;
  private annualBlueContent!:   HTMLElement;
  private annualPurpleContent!: HTMLElement;
  private annualGreenContent!:  HTMLElement;

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
  getIcon():        string { return 'hand-coins'; }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass('tl-dashboard');

    // ── Toolbar ───────────────────────────────────────────────
    const toolbar  = root.createEl('div', { cls: 'tl-toolbar' });
    const tabGroup = toolbar.createEl('div', { cls: 'tl-tab-group' });
    this.monthTabBtn  = tabGroup.createEl('button', { text: 'Monthly',     cls: 'tl-tab-btn' });
    this.annualTabBtn = tabGroup.createEl('button', { text: 'Annual',      cls: 'tl-tab-btn' });
    this.yoyTabBtn    = tabGroup.createEl('button', { text: 'Year on Year', cls: 'tl-tab-btn' });
    toolbar.createEl('div', { cls: 'tl-sep' });
    this.monthNav  = toolbar.createEl('div', { cls: 'tl-nav-slot' });
    this.annualNav = toolbar.createEl('div', { cls: 'tl-nav-slot' });
    const todayBtn = toolbar.createEl('button', { cls: 'tl-today-btn', attr: { title: 'Go to today' } });
    setIcon(todayBtn, 'calendar');
    todayBtn.createEl('span', { text: 'Today', cls: 'tl-btn-label' });

    toolbar.createEl('div', { cls: 'tl-spacer' });

    const logBtn = toolbar.createEl('button', { cls: 'tl-action-btn', attr: { title: 'Log an expense' } });
    setIcon(logBtn, 'pencil');
    logBtn.createEl('span', { text: 'Log', cls: 'tl-btn-label' });

    const registerBtn = toolbar.createEl('button', { cls: 'tl-action-btn', attr: { title: 'New register' } });
    setIcon(registerBtn, 'file-plus');
    registerBtn.createEl('span', { text: 'Register', cls: 'tl-btn-label' });

    toolbar.createEl('span', { text: `v${this.plugin.manifest.version}`, cls: 'tl-version' });

    // ── Monthly outer ──────────────────────────────────────────
    this.monthlyOuter = root.createEl('div', { cls: 'tl-tab-pane' });
    this.dayInfoEl    = this.monthlyOuter.createEl('div', { cls: 'tl-day-info' });
    this.dayInfoEl.style.display = 'none';

    const commitSection = this.monthlyOuter.createEl('div', { cls: 'tl-section tl-section--blue' });
    commitSection.createEl('div', { cls: 'tl-section-header' })
      .createEl('span', { text: 'Summary', cls: 'tl-section-title' });
    this.cardsContent = commitSection.createEl('div');
    commitSection.createEl('div', { text: 'Fixed costs detail', cls: 'tl-subsection-label' });
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
      .createEl('span', { text: 'Planned monthly costs breakdown', cls: 'tl-section-title' });
    this.annualPurpleContent = annualPurpleSection.createEl('div');

    const annualGreenSection = this.annualOuter.createEl('div', { cls: 'tl-section tl-section--green' });
    annualGreenSection.createEl('div', { cls: 'tl-section-header' })
      .createEl('span', { text: 'Unplanned spending', cls: 'tl-section-title' });
    this.annualGreenContent = annualGreenSection.createEl('div');

    // ── Year on Year outer ─────────────────────────────────────
    this.yoyOuter   = root.createEl('div', { cls: 'tl-tab-pane' });
    this.yoyContent = this.yoyOuter.createEl('div');

    // ── Event wiring ───────────────────────────────────────────
    this.monthTabBtn.onclick  = () => this.showTab('monthly');
    this.annualTabBtn.onclick = () => this.showTab('annual');
    this.yoyTabBtn.onclick    = () => this.showTab('yoy');

    logBtn.onclick      = () => new AddEntryModal(this.app, this.plugin).open();
    registerBtn.onclick = () => new CreateRecordModal(this.app, this.plugin).open();

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

  private showTab(tab: 'monthly' | 'annual' | 'yoy'): void {
    this.state.activeTab = tab;
    this.monthlyOuter.style.display = tab === 'monthly' ? '' : 'none';
    this.annualOuter.style.display  = tab === 'annual'  ? '' : 'none';
    this.yoyOuter.style.display     = tab === 'yoy'     ? '' : 'none';
    this.monthNav.style.display     = tab === 'monthly' ? 'flex' : 'none';
    this.annualNav.style.display    = tab === 'annual'  ? 'flex' : 'none';
    this.monthTabBtn.toggleClass('tl-tab-btn--active',  tab === 'monthly');
    this.annualTabBtn.toggleClass('tl-tab-btn--active', tab === 'annual');
    this.yoyTabBtn.toggleClass('tl-tab-btn--active',    tab === 'yoy');
  }

  private openRegisterFile(year: number): void {
    const path = normalizePath(`${this.plugin.settings.dataFolder}/${year}.md`);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) this.app.workspace.getLeaf('tab').openFile(file);
  }

  async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const { year, month, annualYear } = this.state;
      const currency = this.plugin.settings.currencySymbol;
      const folder   = this.plugin.settings.dataFolder;

      // Load with dedup across all required years
      const cache = new Map<number, BudgetEntry[]>();
      const load  = async (y: number): Promise<BudgetEntry[]> => {
        if (!cache.has(y)) cache.set(y, await loadYear(this.app, folder, y));
        return cache.get(y)!;
      };

      const availableYears = getAvailableYears(this.app, folder);
      const [monthRecords, annualRecords] = await Promise.all([load(year), load(annualYear)]);
      await Promise.all(availableYears.map(y => load(y)));
      const allYearsData = availableYears.map(y => ({ year: y, records: cache.get(y)! }));

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
        month === 0  ? yearFileExists(this.app, folder, year - 1) : true,
        month === 11 ? yearFileExists(this.app, folder, year + 1) : true,
        () => this.openRegisterFile(year),
      );

      // Annual nav
      this.annualNav.empty();
      renderNavBar(
        this.annualNav,
        String(annualYear),
        () => { this.state.annualYear--; this.refresh(); },
        () => { this.state.annualYear++; this.refresh(); },
        yearFileExists(this.app, folder, annualYear - 1),
        yearFileExists(this.app, folder, annualYear + 1),
        () => this.openRegisterFile(annualYear),
      );

      renderMonth(
        this.cardsContent, this.spendContent, this.dayInfoEl,
        monthRecords, year, month, currency,
      );
      this.commitContent.empty();
      renderCommitmentsTable(this.commitContent, monthRecords, year, currency);

      renderAnnual(
        this.annualBlueContent, this.annualPurpleContent, this.annualGreenContent,
        annualRecords, annualYear, currency,
      );

      this.yoyContent.empty();
      renderYoY(this.yoyContent, allYearsData, new Date().getFullYear(), currency,
        year => this.openRegisterFile(year));

      this.showTab(this.state.activeTab);
    } finally {
      this.refreshing = false;
    }
  }
}
