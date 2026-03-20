import { App, normalizePath } from 'obsidian';
import { parseRecordsBlock } from './parser';
import type { BudgetEntry } from './types';

export function yearFileExists(app: App, dataFolder: string, year: number): boolean {
  return !!app.vault.getFileByPath(normalizePath(`${dataFolder}/${year}.md`));
}

export async function loadYear(app: App, dataFolder: string, year: number): Promise<BudgetEntry[]> {
  const path = normalizePath(`${dataFolder}/${year}.md`);
  const file = app.vault.getFileByPath(path);
  if (!file) return [];
  const content = await app.vault.read(file);
  const match = content.match(/```yaml\n([\s\S]*?)\n```/);
  return match ? parseRecordsBlock(match[1]) : [];
}
