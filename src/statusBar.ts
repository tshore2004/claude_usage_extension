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

export function formatStatusBarText(stats: UsageStats | null, monthlyBudget: number): string {
  if (!stats) { return '$(cloud) No data'; }
  const pct = Math.round((stats.thisMonth.cost / monthlyBudget) * 100);
  return `$(cloud) ${pct}%`;
}

export function formatTooltip(stats: UsageStats | null, monthlyBudget: number): string {
  if (!stats) { return 'Claude Code Usage: No data available'; }
  const { today, thisMonth, allTime } = stats;
  const pct = Math.round((thisMonth.cost / monthlyBudget) * 100);
  return [
    `This month: ${formatCost(thisMonth.cost)} / ${formatCost(monthlyBudget)} (${pct}%)`,
    `Today:      ${formatCost(today.cost)}`,
    `All time:   ${formatCost(allTime.cost)}`,
    `Updated:    ${stats.lastUpdated.toLocaleTimeString()}`,
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

  update(stats: UsageStats | null, monthlyBudget: number): void {
    this.item.text = formatStatusBarText(stats, monthlyBudget);
    this.item.tooltip = formatTooltip(stats, monthlyBudget);
  }

  setError(message: string): void {
    this.item.text = '$(cloud) $(error)';
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
