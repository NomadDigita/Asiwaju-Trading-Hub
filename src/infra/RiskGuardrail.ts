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

/**
 * Programmatically evaluates trade parameters against strict safety margins
 * @param trade The parsed TradeRequest payload
 */
export function evaluateRiskGuardrails(trade: TradeRequest): GuardrailReport {
  const violations: string[] = [];
  const tradeSizeUSD = trade.price * trade.quantity;

  // 1. Sizing Evaluation
  if (tradeSizeUSD > RISK_BOUNDARIES.MAX_SPOT_SIZE_USD) {
    violations.push(
      `Sizing violation: Requested trade size ($${tradeSizeUSD.toFixed(2)}) exceeds absolute safety cap ($${RISK_BOUNDARIES.MAX_SPOT_SIZE_USD.toFixed(2)})`
    );
  }

  // 2. Whitelisted Asset Evaluation
  if (!RISK_BOUNDARIES.ALLOWED_SYMBOLS.includes(trade.symbol.toUpperCase())) {
    violations.push(
      `Asset validation violation: Symbol '${trade.symbol}' is not on the whitelisted directory of high-liquidity assets`
    );
  }

  // 3. Rate-Limit / Cooldown Evaluation
  const currentTime = Date.now();
  const timeElapsed = currentTime - lastTradeTimestamp;
  if (timeElapsed < RISK_BOUNDARIES.MIN_COOLDOWN_MS) {
    violations.push(
      `Rate-limit violation: Cooldown active. Elapsed time (${(timeElapsed / 1000).toFixed(1)}s) is below mandatory delay (${RISK_BOUNDARIES.MIN_COOLDOWN_MS / 1000}s)`
    );
  }

  const passed = violations.length === 0;

  // If the trade passes, cache the order timestamp to prevent immediate duplicates
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