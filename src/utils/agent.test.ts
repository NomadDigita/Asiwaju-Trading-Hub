import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TradeRequest } from '../infra/RiskGuardrail';
import type { ExecutionReport } from '../infra/ShieldSDK';

// --- Mocks -------------------------------------------------------------
// scanMarketOpportunity() reaches out to: the AI gateway (for the trade
// idea itself), the news sentinel (for macro context), and live price feeds
// (Bitget/Binance/DEXScreener). We mock each boundary explicitly so this
// test is deterministic in any environment, regardless of network access
// or configured API keys.

vi.mock('./ai', () => ({
  callUnifiedAI: vi.fn(async () => JSON.stringify({
    symbol: 'SOLUSDT',
    side: 'buy',
    price: '172.50',
    stopLoss: '168.19',
    takeProfit: '181.13',
    reason: 'Mocked bullish momentum setup for regression test.'
  }))
}));

vi.mock('./sentinel', () => ({
  runNewsAudit: vi.fn(async () => 'Neutral sentiment (mocked for test).')
}));

// This is the critical assertion point: runAutopilotExecution() must route
// every trade through AsiwajuAgentShield.processSecureTrade() — the same
// gate (prompt safety, $10 sizing cap, symbol whitelist, cooldown,
// re-entrancy/replay guards) used by every manually-approved trade. It must
// NEVER call the raw executeApprovedTrade() directly, which is exactly the
// bug that shipped real oversized, unauthenticated autopilot buy orders.
const processSecureTradeMock = vi.fn<
  (prompt: string, tradeRequest: TradeRequest, transactionSignature?: string) => Promise<ExecutionReport>
>(async () => ({
  success: true,
  promptSafety: 'SAFE',
  riskGuardrail: 'PASSED',
  reentrancyGuard: 'PASSED',
  replayGuard: 'PASSED',
  message: 'Mocked execution.',
  orderId: 'MOCK-ORDER-123',
  logs: []
}));

vi.mock('../infra/ShieldSDK', () => ({
  AsiwajuAgentShield: { processSecureTrade: processSecureTradeMock }
}));

// Deterministic fetch mock covering the live price/regime lookups so this
// test doesn't depend on real market data or outbound network access.
function mockFetch(url: string): Promise<any> {
  if (url.includes('/api/v2/spot/market/tickers')) {
    return Promise.resolve({
      status: 200,
      json: async () => ({ code: '00000', data: [{ lastPr: '172.50' }] })
    });
  }
  if (url.includes('binance.com/api/v3/ticker/24hr')) {
    return Promise.resolve({
      status: 200,
      json: async () => ({ priceChangePercent: '1.20', highPrice: '175.00', lowPrice: '170.00' })
    });
  }
  // Anything else (DEXScreener, Bitget order placement, etc.) shouldn't be
  // reached in this test — fail loudly rather than silently returning junk.
  return Promise.reject(new Error(`Unexpected fetch call in test: ${url}`));
}

describe('runAutopilotExecution', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(mockFetch));
    processSecureTradeMock.mockClear();
    // Autopilot is disabled by default (see the safety kill switch in
    // src/utils/agent.ts). Most tests below need to opt in explicitly to
    // exercise the execution path; the dedicated kill-switch test further
    // down deletes this to verify the default-off behavior itself.
    process.env.AUTOPILOT_ENABLED = 'true';
  });

  it('is disabled by default unless AUTOPILOT_ENABLED=true is explicitly set', async () => {
    delete process.env.AUTOPILOT_ENABLED;
    const { runAutopilotExecution } = await import('./agent');
    const result = await runAutopilotExecution('SOL');

    expect(result).toContain('AUTOPILOT_DISABLED');
    expect(processSecureTradeMock).not.toHaveBeenCalled();
  });

  it('routes the trade through AsiwajuAgentShield.processSecureTrade, never the raw executor', async () => {
    const { runAutopilotExecution } = await import('./agent');
    const result = await runAutopilotExecution('SOL');

    expect(processSecureTradeMock).toHaveBeenCalledTimes(1);
    expect(result).toContain('EXECUTED:SOLUSDT:BUY');
    expect(result).toContain('MOCK-ORDER-123');
  });

  it('sizes the position to a fixed ~$5 notional, not a fixed unit count', async () => {
    // This is the exact regression this test guards against: buys used to be
    // hardcoded to "5.0000" units (5 whole BTC/ETH/SOL — potentially
    // thousands to hundreds of thousands of dollars) instead of ~$5 worth.
    const { runAutopilotExecution } = await import('./agent');
    await runAutopilotExecution('SOL');

    expect(processSecureTradeMock).toHaveBeenCalledTimes(1);
    const [, tradeRequest] = processSecureTradeMock.mock.calls[0];
    const notionalUSD = tradeRequest.price * tradeRequest.quantity;

    expect(notionalUSD).toBeGreaterThan(4);
    expect(notionalUSD).toBeLessThan(6);
    // The old bug would have produced a quantity of 5 (whole SOL units),
    // i.e. a notional around $862.50 at this mocked price — sanity-check
    // we are nowhere near that.
    expect(notionalUSD).toBeLessThan(100);
  });

  it('does not treat a Shield-blocked trade as executed', async () => {
    processSecureTradeMock.mockResolvedValueOnce({
      success: false,
      promptSafety: 'SAFE',
      riskGuardrail: 'BLOCKED',
      reentrancyGuard: 'PASSED',
      replayGuard: 'PASSED',
      message: 'Blocked by Code Guardrails: Sizing violation.',
      logs: []
    });

    const { runAutopilotExecution } = await import('./agent');
    const result = await runAutopilotExecution('SOL');

    expect(result).not.toContain('EXECUTED');
    expect(result).toContain('NO_SETUP');
  });
});
