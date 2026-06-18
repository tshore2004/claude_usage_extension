export interface CostEntry {
  timestamp: string;
  session_id: string;
  transcript_path: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
  estimated_cost_usd: number;
}

export interface UsageSummary {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  entryCount: number;
}

export interface UsageStats {
  today: UsageSummary;
  thisMonth: UsageSummary;
  sessionWindow: UsageSummary;  // spending in the last 5 hours (rolling window)
  allTime: UsageSummary;
  byModel: Record<string, UsageSummary>;
  lastUpdated: Date;
}

export const EMPTY_SUMMARY: UsageSummary = {
  cost: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
  entryCount: 0,
};
