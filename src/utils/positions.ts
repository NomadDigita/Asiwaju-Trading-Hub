// This module fills a gap that previously did not exist anywhere in the
// codebase: automatically closing a position once it hits its stop-loss or
// take-profit level. Before this file existed, `stopLoss`/`takeProfit` on a
// TradeProposal were purely cosmetic numbers shown in logs and the UI —
// nothing ever compared them against the live price or placed a closing
// order. That gap is what allowed autopilot buys to sit open indefinitely
// with no automatic exit.
//
// Design notes / known limitations (please read before relying on this):
//  - Position state lives in memory only. It resets if the process
//    restarts. This is a reasonable first implementation for a
//    single-instance deployment, but it is NOT a substitute for real
//    exchange-native conditional (OCO/trigger) orders, which would survive
//    a restart and don't depend on this process staying alive and polling.
//    Consider that a stronger follow-up if you want stronger guarantees.
//  - Every exit routes through AsiwajuAgentShield.processSecureTrade() with
//    isPositionExit=true, so it still gets prompt-safety, re-entrancy, and
//    replay protection — it is only exempt from the $10 sizing cap and the
//    cooldown (see RiskGuardrail.ts's GuardrailOptions for why).
//  - This has not been exercised against the real Bitget API from this
//    development environment (no network access to api.bitget.com here).
//    The pure decision logic (evaluateExitTrigger) is unit tested
//    thoroughly; the live order-placement path should be verified manually
//    with a small position before being trusted unattended.

export interface OpenPosition {
  /** Unique id for this position, so it can be removed precisely after closing. */
  id: string;
  symbol: string;
  /** The side of the ENTRY trade. A 'buy' entry is closed by a 'sell', and vice versa. */
  side: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  openedAt: number;
}

export type ExitTrigger = 'STOP_LOSS' | 'TAKE_PROFIT';

// In-memory registry of currently-open positions. See the module-level
// comment above for why this is in-memory and what that trades off.
const openPositions: Map<string, OpenPosition> = new Map();

let positionIdCounter = 0;

/** Registers a newly-opened position for ongoing stop-loss/take-profit monitoring. */
export function trackOpenPosition(position: Omit<OpenPosition, 'id' | 'openedAt'>): OpenPosition {
  const tracked: OpenPosition = {
    ...position,
    id: `pos_${Date.now()}_${positionIdCounter++}`,
    openedAt: Date.now(),
  };
  openPositions.set(tracked.id, tracked);
  console.log(`📌 [Position Monitor] Now tracking ${tracked.side.toUpperCase()} ${tracked.symbol} (qty ${tracked.quantity}) — SL ${tracked.stopLoss}, TP ${tracked.takeProfit}.`);
  return tracked;
}

/** Returns a snapshot copy of all currently-tracked open positions. */
export function getOpenPositions(): OpenPosition[] {
  return Array.from(openPositions.values());
}

/** Removes a position from tracking (called once its closing order has succeeded). */
export function untrackPosition(id: string): void {
  openPositions.delete(id);
}

/** Test-only helper to reset all tracked state between test cases. */
export function _resetOpenPositionsForTests(): void {
  openPositions.clear();
  positionIdCounter = 0;
}

/**
 * Pure decision function: given a position and the current market price,
 * decide whether it has hit its stop-loss or take-profit level. Kept
 * side-effect-free and exported specifically so it can be unit tested
 * exhaustively without touching the network, the exchange, or the Shield
 * pipeline.
 */
export function evaluateExitTrigger(position: OpenPosition, currentPrice: number): ExitTrigger | null {
  if (position.side === 'buy') {
    // A long position: stop-loss sits below entry, take-profit sits above.
    if (currentPrice <= position.stopLoss) return 'STOP_LOSS';
    if (currentPrice >= position.takeProfit) return 'TAKE_PROFIT';
  } else {
    // A short position: stop-loss sits above entry, take-profit sits below.
    if (currentPrice >= position.stopLoss) return 'STOP_LOSS';
    if (currentPrice <= position.takeProfit) return 'TAKE_PROFIT';
  }
  return null;
}
