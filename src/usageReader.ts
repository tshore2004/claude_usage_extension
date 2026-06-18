import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CostEntry, UsageSummary, UsageStats, EMPTY_SUMMARY } from './types';

export const DEFAULT_COSTS_PATH = path.join(os.homedir(), '.claude', 'metrics', 'costs.jsonl');

export async function readUsageStats(
  filePath: string = DEFAULT_COSTS_PATH,
  now: Date = new Date(),
): Promise<UsageStats | null> {
  let content: string;
  try {
    content = await fs.promises.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }

  const rawEntries = content
    .split('\n')
    .map(parseEntry)
    .filter((e): e is CostEntry => e !== null);

  if (rawEntries.length === 0) { return null; }

  return aggregateStats(deduplicateSessions(rawEntries), now);
}

export function parseEntry(line: string): CostEntry | null {
  const trimmed = line.trim();
  if (!trimmed) { return null; }
  try {
    const obj = JSON.parse(trimmed);
    if (!isValidEntry(obj)) { return null; }
    return obj as CostEntry;
  } catch {
    return null;
  }
}

export function deduplicateSessions(entries: CostEntry[]): CostEntry[] {
  const bySession = new Map<string, CostEntry>();
  for (const entry of entries) {
    const existing = bySession.get(entry.session_id);
    if (!existing || entry.timestamp > existing.timestamp) {
      bySession.set(entry.session_id, entry);
    }
  }
  return Array.from(bySession.values());
}

const SESSION_WINDOW_MS = 5 * 60 * 60 * 1000; // 5-hour rolling window

export function aggregateStats(entries: CostEntry[], now: Date = new Date()): UsageStats {
  const todayPrefix    = now.toISOString().slice(0, 10);
  const monthPrefix    = now.toISOString().slice(0, 7);
  const windowCutoff   = new Date(now.getTime() - SESSION_WINDOW_MS).toISOString();

  const today         = emptySummary();
  const thisMonth     = emptySummary();
  const sessionWindow = emptySummary();
  const allTime       = emptySummary();
  const byModel: Record<string, UsageSummary> = {};

  for (const entry of entries) {
    const d = entry.timestamp.slice(0, 10);
    const m = entry.timestamp.slice(0, 7);

    addToSummary(allTime, entry);
    if (m === monthPrefix) { addToSummary(thisMonth, entry); }
    if (d === todayPrefix) { addToSummary(today, entry); }
    if (entry.timestamp >= windowCutoff) { addToSummary(sessionWindow, entry); }

    if (!byModel[entry.model]) { byModel[entry.model] = emptySummary(); }
    addToSummary(byModel[entry.model], entry);
  }

  return { today, thisMonth, sessionWindow, allTime, byModel, lastUpdated: now };
}

function isValidEntry(obj: unknown): obj is CostEntry {
  if (typeof obj !== 'object' || obj === null) { return false; }
  const required: (keyof CostEntry)[] = [
    'timestamp', 'session_id', 'model',
    'input_tokens', 'output_tokens', 'cache_write_tokens',
    'cache_read_tokens', 'estimated_cost_usd',
  ];
  return required.every(k => k in (obj as Record<string, unknown>));
}

function emptySummary(): UsageSummary {
  return { ...EMPTY_SUMMARY };
}

function addToSummary(s: UsageSummary, e: CostEntry): void {
  s.cost             += e.estimated_cost_usd;
  s.inputTokens      += e.input_tokens;
  s.outputTokens     += e.output_tokens;
  s.cacheWriteTokens += e.cache_write_tokens;
  s.cacheReadTokens  += e.cache_read_tokens;
  s.entryCount       += 1;
}
