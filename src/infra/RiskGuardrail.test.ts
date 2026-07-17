import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { evaluateRiskGuardrails, TradeRequest } from './RiskGuardrail';

// evaluateRiskGuardrails() intentionally keeps a module-level `lastTradeTimestamp`
// so it can enforce a real cooldown between trades. That's correct production
// behavior, but it means every test in this file shares state through the
// cooldown clock unless we control Date.now() explicitly. We use fake timers
// and advance the clock past MIN_COOLDOWN_MS (30s) between test cases so each
// test starts from a clean, deterministic cooldown state.
const COOLDOWN_MS = 30_000;

function advancePastCooldown() {
  vi.setSystemTime(new Date(Date.now() + COOLDOWN_MS + 1));
}

describe('evaluateRiskGuardrails', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    // evaluateRiskGuardrails() keeps its cooldown state in a module-level
    // variable that persists across tests. Rather than resetting the clock
    // to a fixed timestamp each test (which would collide with whatever
    // lastTradeTimestamp the previous test's passing trade left behind), we
    // always advance the clock strictly forward, past any cooldown that
    // could still be armed from the prior test.
    advancePastCooldown();
  });

  it('passes a trade within the size cap on a whitelisted symbol', () => {
    const trade: TradeRequest = { symbol: 'SOLUSDT', side: 'buy', price: 172.50, quantity: 0.05 };
    const report = evaluateRiskGuardrails(trade);
    expect(report.passed).toBe(true);
    expect(report.violations).toHaveLength(0);
  });

  it('blocks a trade that exceeds the $10 sizing cap', () => {
    const trade: TradeRequest = { symbol: 'BTCUSDT', side: 'buy', price: 67000, quantity: 1 };
    const report = evaluateRiskGuardrails(trade);
    expect(report.passed).toBe(false);
    expect(report.violations.some(v => v.includes('Sizing violation'))).toBe(true);
  });

  it('blocks a trade exactly $0.01 over the cap (boundary check)', () => {
    // MAX_SPOT_SIZE_USD is 10.00 — 10.01 must fail, not be rounded/truncated through.
    const trade: TradeRequest = { symbol: 'ETHUSDT', side: 'buy', price: 10.01, quantity: 1 };
    const report = evaluateRiskGuardrails(trade);
    expect(report.passed).toBe(false);
  });

  it('allows a trade exactly at the $10 cap (boundary check)', () => {
    const trade: TradeRequest = { symbol: 'ETHUSDT', side: 'buy', price: 10.00, quantity: 1 };
    const report = evaluateRiskGuardrails(trade);
    expect(report.passed).toBe(true);
  });

  it('blocks a symbol that is not on the whitelist', () => {
    const trade: TradeRequest = { symbol: 'SHIBUSDT', side: 'buy', price: 0.000025, quantity: 1000 };
    const report = evaluateRiskGuardrails(trade);
    expect(report.passed).toBe(false);
    expect(report.violations.some(v => v.includes('Asset validation violation'))).toBe(true);
  });

  it('is case-insensitive on the symbol whitelist check', () => {
    const trade: TradeRequest = { symbol: 'solusdt', side: 'buy', price: 5, quantity: 1 };
    const report = evaluateRiskGuardrails(trade);
    expect(report.passed).toBe(true);
  });

  it('reports multiple simultaneous violations rather than stopping at the first', () => {
    const trade: TradeRequest = { symbol: 'DOGEUSDT', side: 'buy', price: 67000, quantity: 1 };
    const report = evaluateRiskGuardrails(trade);
    expect(report.passed).toBe(false);
    expect(report.violations.length).toBeGreaterThanOrEqual(2);
    expect(report.violations.some(v => v.includes('Sizing violation'))).toBe(true);
    expect(report.violations.some(v => v.includes('Asset validation violation'))).toBe(true);
  });

  it('enforces the 30-second cooldown between consecutive passing trades', () => {
    const trade: TradeRequest = { symbol: 'SOLUSDT', side: 'buy', price: 5, quantity: 1 };

    const first = evaluateRiskGuardrails(trade);
    expect(first.passed).toBe(true);

    // Immediately retry with no time elapsed — should be blocked by cooldown.
    const second = evaluateRiskGuardrails(trade);
    expect(second.passed).toBe(false);
    expect(second.violations.some(v => v.includes('Rate-limit violation'))).toBe(true);
  });

  it('allows a trade again once the cooldown window has fully elapsed', () => {
    const trade: TradeRequest = { symbol: 'SOLUSDT', side: 'buy', price: 5, quantity: 1 };

    expect(evaluateRiskGuardrails(trade).passed).toBe(true);
    advancePastCooldown();
    expect(evaluateRiskGuardrails(trade).passed).toBe(true);
  });

  it('does NOT reset the cooldown clock when a trade is rejected on other grounds', () => {
    // An oversized trade should not count as "the last trade" for cooldown
    // purposes — only a trade that actually PASSES should arm the cooldown.
    const oversized: TradeRequest = { symbol: 'BTCUSDT', side: 'buy', price: 67000, quantity: 1 };
    expect(evaluateRiskGuardrails(oversized).passed).toBe(false);

    const valid: TradeRequest = { symbol: 'SOLUSDT', side: 'buy', price: 5, quantity: 1 };
    const report = evaluateRiskGuardrails(valid);
    expect(report.passed).toBe(true);
  });
});
