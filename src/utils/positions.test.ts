import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateExitTrigger,
  trackOpenPosition,
  getOpenPositions,
  untrackPosition,
  _resetOpenPositionsForTests,
  type OpenPosition,
} from './positions';

function longPosition(overrides: Partial<OpenPosition> = {}): OpenPosition {
  return {
    id: 'test-pos-1',
    symbol: 'SOLUSDT',
    side: 'buy',
    quantity: 0.029,
    entryPrice: 172.50,
    stopLoss: 168.19,   // -2.5%
    takeProfit: 181.13, // +5%
    openedAt: Date.now(),
    ...overrides,
  };
}

describe('evaluateExitTrigger — long (buy) positions', () => {
  it('returns null while price sits between stop-loss and take-profit', () => {
    const pos = longPosition();
    expect(evaluateExitTrigger(pos, 172.50)).toBeNull();
    expect(evaluateExitTrigger(pos, 175.00)).toBeNull();
    expect(evaluateExitTrigger(pos, 170.00)).toBeNull();
  });

  it('triggers STOP_LOSS when price falls to or below the stop level', () => {
    const pos = longPosition();
    expect(evaluateExitTrigger(pos, 168.19)).toBe('STOP_LOSS');
    expect(evaluateExitTrigger(pos, 150.00)).toBe('STOP_LOSS');
  });

  it('triggers TAKE_PROFIT when price rises to or above the target', () => {
    const pos = longPosition();
    expect(evaluateExitTrigger(pos, 181.13)).toBe('TAKE_PROFIT');
    expect(evaluateExitTrigger(pos, 200.00)).toBe('TAKE_PROFIT');
  });

  it('does NOT sit forever unresolved: price hasn\'t reached target yet stays null (regression for "auto TP even if it hasn\'t reached the set price")', () => {
    // This directly encodes the reported bug: a position must NOT be
    // treated as closeable just because time has passed — only because the
    // price actually crossed the stop-loss or take-profit level.
    const pos = longPosition({ takeProfit: 181.13, stopLoss: 168.19 });
    expect(evaluateExitTrigger(pos, 180.99)).toBeNull();
    expect(evaluateExitTrigger(pos, 168.20)).toBeNull();
  });
});

describe('evaluateExitTrigger — short (sell) positions', () => {
  it('mirrors the logic: stop-loss above entry, take-profit below', () => {
    const pos = longPosition({ side: 'sell', entryPrice: 172.50, stopLoss: 176.81, takeProfit: 163.88 });
    expect(evaluateExitTrigger(pos, 172.50)).toBeNull();
    expect(evaluateExitTrigger(pos, 176.81)).toBe('STOP_LOSS');
    expect(evaluateExitTrigger(pos, 180.00)).toBe('STOP_LOSS');
    expect(evaluateExitTrigger(pos, 163.88)).toBe('TAKE_PROFIT');
    expect(evaluateExitTrigger(pos, 150.00)).toBe('TAKE_PROFIT');
  });
});

describe('position tracking registry', () => {
  beforeEach(() => {
    _resetOpenPositionsForTests();
  });

  it('starts empty', () => {
    expect(getOpenPositions()).toHaveLength(0);
  });

  it('tracks a new position with a generated id and timestamp', () => {
    const tracked = trackOpenPosition({
      symbol: 'BTCUSDT',
      side: 'buy',
      quantity: 0.0001,
      entryPrice: 67000,
      stopLoss: 65325,
      takeProfit: 70350,
    });

    expect(tracked.id).toBeTruthy();
    expect(tracked.openedAt).toBeGreaterThan(0);
    expect(getOpenPositions()).toHaveLength(1);
    expect(getOpenPositions()[0].symbol).toBe('BTCUSDT');
  });

  it('removes a position once untracked', () => {
    const tracked = trackOpenPosition({
      symbol: 'ETHUSDT',
      side: 'buy',
      quantity: 0.001,
      entryPrice: 3740,
      stopLoss: 3646.5,
      takeProfit: 3927,
    });

    expect(getOpenPositions()).toHaveLength(1);
    untrackPosition(tracked.id);
    expect(getOpenPositions()).toHaveLength(0);
  });

  it('tracks multiple independent positions correctly', () => {
    trackOpenPosition({ symbol: 'BTCUSDT', side: 'buy', quantity: 0.0001, entryPrice: 67000, stopLoss: 65325, takeProfit: 70350 });
    trackOpenPosition({ symbol: 'SOLUSDT', side: 'buy', quantity: 0.029, entryPrice: 172.5, stopLoss: 168.19, takeProfit: 181.13 });

    expect(getOpenPositions()).toHaveLength(2);
    const symbols = getOpenPositions().map(p => p.symbol).sort();
    expect(symbols).toEqual(['BTCUSDT', 'SOLUSDT']);
  });
});
