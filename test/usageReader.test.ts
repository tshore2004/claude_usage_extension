import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  parseEntry,
  deduplicateSessions,
  aggregateStats,
  readUsageStats,
} from '../src/usageReader';
import { CostEntry } from '../src/types';

function assertCloseTo(actual: number, expected: number, delta = 0.001, msg = '') {
  assert.ok(
    Math.abs(actual - expected) <= delta,
    msg || `Expected ${actual} to be within ${delta} of ${expected}`
  );
}

function makeEntry(overrides: Partial<CostEntry> = {}): CostEntry {
  return {
    timestamp: '2026-06-18T10:00:00.000Z',
    session_id: 'session-a',
    transcript_path: '/tmp/a.jsonl',
    model: 'claude-sonnet-4-6',
    input_tokens: 100,
    output_tokens: 200,
    cache_write_tokens: 300,
    cache_read_tokens: 400,
    estimated_cost_usd: 1.00,
    ...overrides,
  };
}

const TODAY = '2026-06-18';
const THIS_MONTH = '2026-06';

suite('parseEntry', () => {
  test('parses a valid JSON line', () => {
    const raw = JSON.stringify(makeEntry());
    const result = parseEntry(raw);
    assert.ok(result);
    assert.strictEqual(result!.session_id, 'session-a');
    assert.strictEqual(result!.estimated_cost_usd, 1.00);
  });

  test('returns null for empty line', () => {
    assert.strictEqual(parseEntry(''), null);
    assert.strictEqual(parseEntry('   '), null);
  });

  test('returns null for malformed JSON', () => {
    assert.strictEqual(parseEntry('{bad json}'), null);
  });

  test('returns null when required field is missing', () => {
    const raw = JSON.stringify({ timestamp: '2026-06-18T00:00:00Z' });
    assert.strictEqual(parseEntry(raw), null);
  });
});

suite('deduplicateSessions', () => {
  test('keeps last entry per session_id (cumulative snapshots)', () => {
    const entries: CostEntry[] = [
      makeEntry({ session_id: 'a', estimated_cost_usd: 1.0, timestamp: '2026-06-18T10:00:00Z' }),
      makeEntry({ session_id: 'a', estimated_cost_usd: 3.0, timestamp: '2026-06-18T10:05:00Z' }),
      makeEntry({ session_id: 'b', estimated_cost_usd: 2.0, timestamp: '2026-06-18T09:00:00Z' }),
    ];
    const result = deduplicateSessions(entries);
    assert.strictEqual(result.length, 2);
    const sessionA = result.find(e => e.session_id === 'a');
    assert.strictEqual(sessionA!.estimated_cost_usd, 3.0);
  });

  test('handles empty array', () => {
    assert.deepStrictEqual(deduplicateSessions([]), []);
  });
});

suite('aggregateStats', () => {
  test('correctly buckets today vs month vs allTime', () => {
    const entries: CostEntry[] = [
      makeEntry({ session_id: 'today-1', estimated_cost_usd: 5.0, timestamp: `${TODAY}T08:00:00Z` }),
      makeEntry({ session_id: 'month-1', estimated_cost_usd: 3.0, timestamp: `${THIS_MONTH}-10T12:00:00Z` }),
      makeEntry({ session_id: 'old-1',   estimated_cost_usd: 1.0, timestamp: '2026-05-01T00:00:00Z' }),
    ];
    const now = new Date(`${TODAY}T12:00:00Z`);
    const stats = aggregateStats(entries, now);

    assertCloseTo(stats.today.cost, 5.0);
    assertCloseTo(stats.thisMonth.cost, 8.0);
    assertCloseTo(stats.allTime.cost, 9.0);
    assert.strictEqual(stats.today.entryCount, 1);
    assert.strictEqual(stats.allTime.entryCount, 3);
  });

  test('today tokens sum correctly', () => {
    const entry = makeEntry({
      session_id: 'tok-1',
      timestamp: `${TODAY}T10:00:00Z`,
      input_tokens: 100, output_tokens: 200,
      cache_write_tokens: 300, cache_read_tokens: 400,
    });
    const stats = aggregateStats([entry], new Date(`${TODAY}T12:00:00Z`));
    assert.strictEqual(stats.today.inputTokens, 100);
    assert.strictEqual(stats.today.outputTokens, 200);
    assert.strictEqual(stats.today.cacheWriteTokens, 300);
    assert.strictEqual(stats.today.cacheReadTokens, 400);
  });

  test('byModel aggregation is correct', () => {
    const entries: CostEntry[] = [
      makeEntry({ session_id: 's1', model: 'claude-sonnet-4-6', estimated_cost_usd: 5.0 }),
      makeEntry({ session_id: 's2', model: 'claude-opus-4',     estimated_cost_usd: 10.0 }),
    ];
    const stats = aggregateStats(entries, new Date());
    assertCloseTo(stats.byModel['claude-sonnet-4-6'].cost, 5.0);
    assertCloseTo(stats.byModel['claude-opus-4'].cost, 10.0);
  });

  test('returns zero summary for empty entries', () => {
    const stats = aggregateStats([], new Date());
    assert.strictEqual(stats.today.cost, 0);
    assert.strictEqual(stats.allTime.cost, 0);
    assert.deepStrictEqual(stats.byModel, {});
  });
});

suite('readUsageStats (file I/O)', () => {
  let tmpFile: string;

  setup(() => {
    tmpFile = path.join(os.tmpdir(), `costs-test-${Date.now()}.jsonl`);
  });

  teardown(() => {
    if (fs.existsSync(tmpFile)) { fs.unlinkSync(tmpFile); }
  });

  test('returns null when file does not exist', async () => {
    const result = await readUsageStats('/nonexistent/path/costs.jsonl');
    assert.strictEqual(result, null);
  });

  test('returns null for an empty file', async () => {
    fs.writeFileSync(tmpFile, '');
    assert.strictEqual(await readUsageStats(tmpFile), null);
  });

  test('parses a valid file', async () => {
    const entry = makeEntry({ estimated_cost_usd: 7.5, timestamp: `${TODAY}T09:00:00Z` });
    fs.writeFileSync(tmpFile, JSON.stringify(entry) + '\n');
    const result = await readUsageStats(tmpFile);
    assert.ok(result);
    assertCloseTo(result!.allTime.cost, 7.5);
  });

  test('skips malformed lines gracefully', async () => {
    const good = JSON.stringify(makeEntry({ estimated_cost_usd: 2.0, timestamp: `${TODAY}T10:00:00Z` }));
    fs.writeFileSync(tmpFile, `{bad json}\n${good}\n`);
    const result = await readUsageStats(tmpFile);
    assert.ok(result);
    assertCloseTo(result!.allTime.cost, 2.0);
  });
});
