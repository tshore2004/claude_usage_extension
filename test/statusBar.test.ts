import * as assert from 'assert';
import { formatCost, formatTokenCount, formatStatusBarText, buildDetailItems } from '../src/statusBar';
import { UsageStats, UsageSummary } from '../src/types';

function assertCloseTo(actual: number, expected: number, delta = 0.001) {
  assert.ok(Math.abs(actual - expected) <= delta, `Expected ${actual} ≈ ${expected}`);
}

function makeSummary(cost: number): UsageSummary {
  return { cost, inputTokens: 100, outputTokens: 200, cacheWriteTokens: 300, cacheReadTokens: 400, entryCount: 1 };
}

function makeStats(todayCost: number, monthCost: number, allTimeCost: number, sessionCost = todayCost): UsageStats {
  return {
    today: makeSummary(todayCost),
    thisMonth: makeSummary(monthCost),
    sessionWindow: makeSummary(sessionCost),
    allTime: makeSummary(allTimeCost),
    byModel: { 'claude-sonnet-4-6': makeSummary(allTimeCost) },
    lastUpdated: new Date('2026-06-18T12:00:00Z'),
  };
}

suite('formatCost', () => {
  test('formats zero', () => assert.strictEqual(formatCost(0), '$0.00'));
  test('formats 1.5', () => assert.strictEqual(formatCost(1.5), '$1.50'));
  test('rounds to 2dp', () => assert.strictEqual(formatCost(15.313464), '$15.31'));
  test('rounds up', () => assert.strictEqual(formatCost(1.999), '$2.00'));
});

suite('formatTokenCount', () => {
  test('sub-thousand is plain number', () => assert.strictEqual(formatTokenCount(999), '999'));
  test('1500 → 1.5K', () => assert.strictEqual(formatTokenCount(1500), '1.5K'));
  test('2_500_000 → 2.5M', () => assert.strictEqual(formatTokenCount(2_500_000), '2.5M'));
  test('exactly 1000 → 1.0K', () => assert.strictEqual(formatTokenCount(1000), '1.0K'));
});

suite('formatStatusBarText', () => {
  test('returns "No data" text when stats is null', () => {
    assert.ok(formatStatusBarText(null, 20).includes('No data'));
  });
  test('shows percentage of session budget using sessionWindow cost', () => {
    // sessionWindow=10 (sessionCost arg), sessionBudget=20 → 50%
    assert.ok(formatStatusBarText(makeStats(5, 20, 30, 10), 20).includes('50%'));
  });
  test('starts with claude-logo codicon', () => {
    assert.ok(formatStatusBarText(makeStats(5, 5, 5), 20).startsWith('$(claude-logo)'));
  });
});

suite('buildDetailItems', () => {
  test('includes today, month, all-time, and model items', () => {
    const items = buildDetailItems(makeStats(5, 15, 25));
    const labels = items.map(i => i.label.toLowerCase());
    assert.ok(labels.some(l => l.includes('today')));
    assert.ok(labels.some(l => l.includes('month')));
    assert.ok(labels.some(l => l.includes('all time')));
    assert.ok(labels.some(l => l.includes('sonnet') || l.includes('claude')));
  });

  test('today item shows correct cost in description', () => {
    const items = buildDetailItems(makeStats(5, 15, 25));
    const todayItem = items.find(i => i.label.toLowerCase().includes('today'));
    assert.ok(todayItem);
    assert.ok(
      todayItem!.description?.includes('$5.00') || todayItem!.detail?.includes('$5.00'),
      'Expected $5.00 in today item'
    );
  });
});
