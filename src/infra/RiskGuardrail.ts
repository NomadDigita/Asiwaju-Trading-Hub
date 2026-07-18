import dotenv from 'dotenv';
dotenv.config();

export interface TradeRequest {
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
}

export interface GuardrailReport {
  passed: boolean;
  violations: string[];
}

// Immutable risk boundaries defined at the compiler layer (LLM cannot override these)
const RISK_BOUNDARIES = {
  MAX_SPOT_SIZE_USD: 10.00, // Maximum USD value allowed per transaction
  ALLOWED_SYMBOLS: ['BTCUSDT', 'SOLUSDT', 'ETHUSDT'], // Strictly whitelisted assets
  MIN_COOLDOWN_MS: 30000, // 30 seconds mandatory cooldown between orders
};

// In-memory cache to track consecutive order timestamps
let lastTradeTimestamp = 0;

export interface GuardrailOptions {
  /**
   * Set when this trade is CLOSING an existing tracked position (a
   * stop-loss or take-profit exit), not opening a new discretionary one.
   * Exits are exempt from the sizing cap (a winning position can grow
   * beyond $10 in value and must still be fully closeable) and from the
   * cooldown (an unrelated trade elsewhere must never delay closing a
   * position that has hit its stop). Blocking an exit would itself be a
   * risk-management failure. The symbol whitelist still applies as a
   * sanity check, since positions should only ever have been opened on a
   * whitelisted symbol to begin with.
   */
  isPositionExit?: boolean;
}

/**
 * Programmatically evaluates trade parameters against strict safety margins
 * @param trade The parsed TradeRequest payload
 * @param options See GuardrailOptions
 */
export function evaluateRiskGuardrails(trade: TradeRequest, options: GuardrailOptions = {}): GuardrailReport {
  const violations: string[] = [];
  const tradeSizeUSD = trade.price * trade.quantity;

  // 1. Sizing Evaluation (skipped for position exits — see GuardrailOptions)
  if (!options.isPositionExit && tradeSizeUSD > RISK_BOUNDARIES.MAX_SPOT_SIZE_USD) {
    violations.push(
      `Sizing violation: Requested trade size ($${tradeSizeUSD.toFixed(2)}) exceeds absolute safety cap ($${RISK_BOUNDARIES.MAX_SPOT_SIZE_USD.toFixed(2)})`
    );
  }

  // 2. Whitelisted Asset Evaluation (always enforced, including on exits)
  if (!RISK_BOUNDARIES.ALLOWED_SYMBOLS.includes(trade.symbol.toUpperCase())) {
    violations.push(
      `Asset validation violation: Symbol '${trade.symbol}' is not on the whitelisted directory of high-liquidity assets`
    );
  }

  // 3. Rate-Limit / Cooldown Evaluation (skipped for position exits — see GuardrailOptions)
  const currentTime = Date.now();
  const timeElapsed = currentTime - lastTradeTimestamp;
  if (!options.isPositionExit && timeElapsed < RISK_BOUNDARIES.MIN_COOLDOWN_MS) {
    violations.push(
      `Rate-limit violation: Cooldown active. Elapsed time (${(timeElapsed / 1000).toFixed(1)}s) is below mandatory delay (${RISK_BOUNDARIES.MIN_COOLDOWN_MS / 1000}s)`
    );
  }

  const passed = violations.length === 0;

  // If the trade passes, cache the order timestamp to prevent immediate
  // duplicates — including for exits, so a fresh cooldown window starts
  // after closing a position and guards against an immediate whipsaw
  // re-entry right after a stop-out.
  if (passed) {
    lastTradeTimestamp = currentTime;
  }

  return { passed, violations };
}

// Self-executing CLI test block
if (require.main === module) {
  // We will run a test simulating an out-of-bounds, unapproved trade request
  const unsafeRequest: TradeRequest = {
    symbol: "SHIBUSDT", // Unapproved low-cap asset
    side: "buy",
    price: 0.000025,
    quantity: 1000000 // Total USD value = $25.00 (Exceeds our $10.00 cap)
  };

  console.log("🔒 Running Asiwaju Agent Shield Risk Guardrail Checks...");
  console.log("📦 Incoming Trade Request:", JSON.stringify(unsafeRequest, null, 2));

  const report = evaluateRiskGuardrails(unsafeRequest);

  console.log("\n=================================");
  console.log("🛰️ Guardrail Evaluation Complete.");
  console.log(`🛡️ Verdict Status: ${report.passed ? '🟢 PASSED' : '🔴 BLOCKED'}`);
  if (!report.passed) {
    console.log("🚨 Violations Detected:");
    report.violations.forEach((v, idx) => console.log(`  ${idx + 1}. ${v}`));
  }
  console.log("=================================\n");
}