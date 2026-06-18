import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { readUsageStats, DEFAULT_COSTS_PATH } from './usageReader';
import { StatusBarController, buildDetailItems } from './statusBar';
import { UsageStats } from './types';

const COMMAND_ID = 'claude-code-usage.showDetails';
const DEBOUNCE_MS = 500;

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = new StatusBarController(COMMAND_ID);
  context.subscriptions.push(statusBar);

  let currentStats: UsageStats | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let watcher: fs.FSWatcher | null = null;

  function getMonthlyBudget(): number {
    return vscode.workspace.getConfiguration('claude-code-usage').get<number>('monthlyBudget', 50);
  }

  async function refresh(): Promise<void> {
    try {
      currentStats = await readUsageStats(DEFAULT_COSTS_PATH);
      statusBar.update(currentStats, getMonthlyBudget());
    } catch (err) {
      statusBar.setError(err instanceof Error ? err.message : String(err));
    }
  }

  function scheduleRefresh(): void {
    if (debounceTimer) { clearTimeout(debounceTimer); }
    debounceTimer = setTimeout(() => { debounceTimer = null; refresh(); }, DEBOUNCE_MS);
  }

  function startWatcher(): void {
    const dir = path.dirname(DEFAULT_COSTS_PATH);
    try {
      watcher = fs.watch(dir, { persistent: false }, (_event, filename) => {
        if (filename === path.basename(DEFAULT_COSTS_PATH)) { scheduleRefresh(); }
      });
      watcher.on('error', () => { watcher = null; });
    } catch {
      // Directory doesn't exist yet; extension shows "No data" until it appears
    }
  }

  const command = vscode.commands.registerCommand(COMMAND_ID, () => {
    if (!currentStats) {
      vscode.window.showInformationMessage(
        'Claude Code Usage: No usage data found. Run Claude Code to generate data.',
      );
      return;
    }
    vscode.window.showQuickPick(buildDetailItems(currentStats), {
      title: 'Claude Code Usage Breakdown',
      placeHolder: 'Usage statistics (read-only)',
      canPickMany: false,
      matchOnDescription: false,
      matchOnDetail: false,
    });
  });

  context.subscriptions.push(command);
  context.subscriptions.push({
    dispose: () => {
      if (debounceTimer) { clearTimeout(debounceTimer); }
      watcher?.close();
    },
  });

  startWatcher();
  refresh();
}

export function deactivate(): void {}
