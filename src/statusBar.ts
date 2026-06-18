import * as vscode from 'vscode';
import { UsageStats, UsageSummary } from './types';

export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) { return `${(n / 1_000_000).toFixed(1)}M`; }
  if (n >= 1_000)     { return `${(n / 1_000).toFixed(1)}K`; }
  return String(n);
}

export function formatStatusBarText(stats: UsageStats | null, sessionBudget: number): string {
  if (!stats) { return '$(claude-logo) No data'; }
  const pct = Math.min(999, Math.round((stats.sessionWindow.cost / sessionBudget) * 100));
  return `$(claude-logo) ${pct}%`;
}

export function formatTooltip(stats: UsageStats | null, sessionBudget: number, monthlyBudget: number): string {
  if (!stats) { return 'Claude Code Usage: No data available'; }
  const { today, thisMonth, sessionWindow, allTime } = stats;
  const sessionPct = Math.min(999, Math.round((sessionWindow.cost / sessionBudget) * 100));
  const monthPct   = Math.round((thisMonth.cost / monthlyBudget) * 100);
  return [
    `5-hr window: ${formatCost(sessionWindow.cost)} / ${formatCost(sessionBudget)} (${sessionPct}%)`,
    `Today:       ${formatCost(today.cost)}`,
    `This month:  ${formatCost(thisMonth.cost)} / ${formatCost(monthlyBudget)} (${monthPct}%)`,
    `All time:    ${formatCost(allTime.cost)}`,
    `Updated:     ${stats.lastUpdated.toLocaleTimeString()}`,
  ].join('\n');
}

export function buildDetailItems(stats: UsageStats): vscode.QuickPickItem[] {
  const items: vscode.QuickPickItem[] = [];
  items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
  items.push(makeSummaryItem('$(calendar) Today', stats.today));
  items.push(makeSummaryItem('$(history) This Month', stats.thisMonth));
  items.push(makeSummaryItem('$(database) All Time', stats.allTime));
  items.push({ label: 'By Model', kind: vscode.QuickPickItemKind.Separator });
  for (const [model, summary] of Object.entries(stats.byModel)) {
    items.push(makeSummaryItem(`$(symbol-class) ${model}`, summary));
  }
  return items;
}

export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor(commandId: string) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = commandId;
    this.item.name = 'Claude Code Usage';
    this.item.show();
  }

  update(stats: UsageStats | null, sessionBudget: number, monthlyBudget: number): void {
    this.item.text = formatStatusBarText(stats, sessionBudget);
    this.item.tooltip = formatTooltip(stats, sessionBudget, monthlyBudget);
  }

  setError(message: string): void {
    this.item.text = '$(claude-logo) $(error)';
    this.item.tooltip = `Claude Code Usage: ${message}`;
  }

  dispose(): void { this.item.dispose(); }
}

function makeSummaryItem(label: string, s: UsageSummary): vscode.QuickPickItem {
  const total = s.inputTokens + s.outputTokens + s.cacheWriteTokens + s.cacheReadTokens;
  return {
    label,
    description: formatCost(s.cost),
    detail: [
      `In: ${formatTokenCount(s.inputTokens)}`,
      `Out: ${formatTokenCount(s.outputTokens)}`,
      `Cache W: ${formatTokenCount(s.cacheWriteTokens)}`,
      `Cache R: ${formatTokenCount(s.cacheReadTokens)}`,
      `Total: ${formatTokenCount(total)}`,
    ].join('  |  '),
  };
}
