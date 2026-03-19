import { App, PluginSettingTab, Setting } from 'obsidian';
import type ThriftLensPlugin from './main';

export interface ThriftLensSettings {
  currencySymbol: string;
  dataFolder:     string;
  defaultView:    'monthly' | 'annual';
}

export const DEFAULT_SETTINGS: ThriftLensSettings = {
  currencySymbol: '€',
  dataFolder:     'thriftLens',
  defaultView:    'monthly',
};

export class ThriftLensSettingTab extends PluginSettingTab {
  private plugin: ThriftLensPlugin;

  constructor(app: App, plugin: ThriftLensPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Currency symbol')
      .setDesc('Symbol prepended to monetary values.')
      .addText(text => text
        .setPlaceholder('€')
        .setValue(this.plugin.settings.currencySymbol)
        .onChange(async value => {
          this.plugin.settings.currencySymbol = value || '€';
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Data folder')
      .setDesc('Vault folder containing budget record files (YYYY.md).')
      .addText(text => text
        .setPlaceholder('thriftLens')
        .setValue(this.plugin.settings.dataFolder)
        .onChange(async value => {
          this.plugin.settings.dataFolder = value || 'thriftLens';
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Default view')
      .setDesc('Which tab opens by default.')
      .addDropdown(drop => drop
        .addOption('monthly', 'Monthly')
        .addOption('annual',  'Annual')
        .setValue(this.plugin.settings.defaultView)
        .onChange(async value => {
          this.plugin.settings.defaultView = value as 'monthly' | 'annual';
          await this.plugin.saveSettings();
        }));
  }
}
