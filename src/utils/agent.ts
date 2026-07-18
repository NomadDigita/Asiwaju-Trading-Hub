import dotenv from 'dotenv';
dotenv.config();

import { getBitgetHeaders } from './bitget';
import { runNewsAudit } from './sentinel';
import { extractJsonFromText } from './json';
import { callUnifiedAI } from './ai';
import type { TradeRequest } from '../infra/RiskGuardrail';
import { AsiwajuAgentShield } from '../infra/ShieldSDK';
import { getOpenPositions, untrackPosition, evaluateExitTrigger } from './positions';

export interface TradeProposal {
  symbol: string;
  side: 'buy' | 'sell';
  price: string;
  quantity: string;
  stopLoss: string;
  takeProfit: string;
  reason: string;
}

interface RegimeReport {
  regime: string;
  volatility: string;
  change: string;
}

// Thin wrapper around the shared JSON extractor that preserves this module's diagnostic logging.
function extractShieldJson(rawText: string): any {
  console.log("🔍 [DIAGNOSTIC] Extracting JSON boundary coordinates...");
  try {
    const parsed = extractJsonFromText(rawText);
    console.log("🔍 [DIAGNOSTIC] Isolated JSON substring successfully. Compiling object...");
    return parsed;
  } catch (err) {
    console.error("❌ [DIAGNOSTIC] JSON coordinates missing in raw payload:", rawText);
    throw err;
  }
}

// 1. Perception Layer: Multi-Exchange Price Feed (Queries Bitget Public API first to resolve BGB/BNB accurately)
async function getLivePrice(symbol: string): Promise<string> {
  const ticker = symbol.replace("USDT", "").toUpperCase();
  console.log(`🔍 [DIAGNOSTIC] Perception check: Pulling live pricing feed for ${ticker}...`);

  // Step A: Query Bitget Public Spot Ticker API directly (Rate-limit free, resolved BGB and BNB perfectly)
  try {
    const requestPath = `/api/v2/spot/market/tickers?symbol=${symbol.toUpperCase()}`;
    const response = await fetch('https://api.bitget.com' + requestPath);
    if (response.status === 200) {
      const result = await response.json();
      if (result.code === '00000' && Array.isArray(result.data) && result.data[0]) {
        const price = result.data[0].lastPr;
        console.log(`🎯 [Bitget Public Feed] Resolved ${symbol} price at $${parseFloat(price).toFixed(4)}`);
        return price;
      }
    }
  } catch (bitgetErr: any) {
    console.warn(`⚠️ [Bitget Feed] Public ticker query failed for ${symbol}:`, bitgetErr.message);
  }

  // Step B: Secondary Fallback via Binance CEX API
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol.toUpperCase()}`);
    if (res.status === 200) {
      const data = await res.json();
      if (data && data.price) {
        console.log(`🔍 [DIAGNOSTIC] CEX check: Binance API resolved ${symbol} at $${parseFloat(data.price).toFixed(4)}`);
        return parseFloat(data.price).toString();
      }
    }
  } catch (cexErr: any) {
    console.warn(`⚠️ [CEX Feed] Binance ticker failed for ${symbol}: ${cexErr.message}`);
  }

  // Step C: DEXScreener Fallback for custom DeFi tokens
  try {
    console.log(`🛰️ [DEX Fallback] Querying DEXScreener pools for ${ticker}...`);
    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${ticker}`);
    if (dexRes.status === 200) {
      const dexData = await dexRes.json();
      if (dexData && Array.isArray(dexData.pairs) && dexData.pairs.length > 0) {
        const matchedPair = dexData.pairs.find((p: any) => p.quoteToken?.symbol === "USDT" || p.quoteToken?.symbol === "USDC") || dexData.pairs[0];
        if (matchedPair && matchedPair.priceUsd) {
          console.log(`🎯 [DEX Feed] DEXScreener resolved ${ticker} pool price at $${parseFloat(matchedPair.priceUsd).toFixed(4)}`);
          return parseFloat(matchedPair.priceUsd).toString();
        }
      }
    }
  } catch (dexErr: any) {
    console.error(`❌ [DEX Feed] DEXScreener pool query failed for ${ticker}:`, dexErr.message);
  }

  return symbol.startsWith("BTC") ? "68250.00" : symbol.startsWith("ETH") ? "3740.00" : "1.25";
}

// 2. Regime Detection Layer: Analyzes price bounds & volatility to identify current trading regime
async function getMarketRegime(symbol: string): Promise<RegimeReport> {
  const ticker = symbol.replace("USDT", "").toUpperCase();
  console.log(`🔍 [DIAGNOSTIC] Regime check: Analyzing volatility profile for ${ticker}...`);

  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (res.status === 200) {
      const data = await res.json();
      const change = parseFloat(data.priceChangePercent) || 0;
      const high = parseFloat(data.highPrice) || 0;
      const low = parseFloat(data.lowPrice) || 0;
      const volatility = low > 0 ? (((high - low) / low) * 100).toFixed(2) : "0.00";

      let regime = "Ranging (Sideways)";
      if (change >= 2.5) regime = "Trending Bullish (Momentum)";
      else if (change <= -2.5) regime = "Trending Bearish (Defensive)";

      console.log(`🔍 [DIAGNOSTIC] Regime check: CEX reports ${ticker} change: ${change}% | Volatility Index: ${volatility}%`);
      return { regime, volatility, change: change.toFixed(2) };
    }
  } catch {
    console.warn(`⚠️ [Regime CEX Feed] Failed to fetch 24h ticker for ${symbol}. Trying DEXScreener data...`);
  }

  try {
    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${ticker}`);
    if (dexRes.status === 200) {
      const dexData = await dexRes.json();
      if (dexData && Array.isArray(dexData.pairs) && dexData.pairs.length > 0) {
        const matchedPair = dexData.pairs[0];
        const change = parseFloat(matchedPair.priceChange?.h24) || 0;
        let regime = "Ranging (Sideways)";
        if (change >= 2.5) regime = "Trending Bullish (Momentum)";
        else if (change <= -2.5) regime = "Trending Bearish (Defensive)";

        console.log(`🎯 [Regime DEX Feed] DEXScreener reports ${ticker} 24h change: ${change}%`);
        return { regime, volatility: "2.50", change: change.toFixed(2) };
      }
    }
  } catch (dexErr: any) {
    console.error("❌ [Regime DEX Feed] Failed to resolve pool metrics:", dexErr.message);
  }

  return { regime: "Ranging (Sideways)", volatility: "1.50", change: "0.00" };
}

// 3. Decision Layer: Scan market and generate trade proposals
export async function scanMarketOpportunity(coin: string): Promise<TradeProposal | null> {
  const symbol = `${coin.toUpperCase()}USDT`;
  console.log(`🔍 [DIAGNOSTIC] Initiating scanMarketOpportunity for ${symbol}...`);
  
  const livePrice = await getLivePrice(symbol);
  const priceNum = parseFloat(livePrice);
  
  if (priceNum === 0 || isNaN(priceNum)) {
    console.warn(`⚠️ Unable to resolve active pricing feed for ${symbol}. Skipping scan.`);
    return null;
  }

  const marketRegime = await getMarketRegime(symbol);

  console.log(`🔍 [DIAGNOSTIC] Querying Sentinel for dynamic market feedstock...`);
  let sentimentSummary = "Macro indicators ranging.";
  try {
    const sentinelData = await runNewsAudit();
    sentimentSummary = sentinelData.slice(0, 500);
    console.log(`🔍 [DIAGNOSTIC] Sentinel context feed retrieved: "${sentimentSummary.slice(0, 100)}..."`);
  } catch (err: any) {
    console.warn("⚠️ Failed to parse news sentiment. Proceeding on technicals alone:", err.message);
  }

  // NOTE: no early API-key check here. callUnifiedAI() below already
  // implements its own Qwen -> MuleRun failover and raises a clear,
  // combined error if *both* providers are unavailable. A prior version of
  // this function hard-required QWEN_API_KEY specifically before ever
  // attempting a call, which meant every scan (manual and autopilot alike)
  // threw immediately whenever that one key was missing or exhausted —
  // even when MULERUN_API_KEY was correctly configured and would have
  // worked fine as a fallback.
  const agentBrainPrompt = `You are the Chief Quantitative Execution Agent at Asiwaju AI Hub. 
  Your objective is to evaluate current market data, price points, Sentinel sentiment digests, and the active Market Regime metrics.
  
  Current Market Environment Context:
  • **Active Regime:** ${marketRegime.regime}
  • **24h Volatility Index:** ${marketRegime.volatility}%
  • **24h Price Change:** ${marketRegime.change}%
  
  Algorithmic Style Shifting Instructions:
  - If the active regime is "Ranging (Sideways)": Formulate a range-bound mean-reversion setup (Buy support or Sell resistance horizontal zones).
  - If the active regime is "Trending Bullish (Momentum)": Formulate an aggressive momentum breakout setup (Buy daily highs or moving average consolidations).
  - If the active regime is "Trending Bearish (Defensive)": Formulate a defensive risk-hedging setup, short-sell proposal, or a strict capital preservation play.
  
  You MUST return a valid JSON object matching this structure (and absolutely no other text, conversational wrapper, or markdown syntax):
  {
    "symbol": "${symbol}",
    "side": "buy",
    "price": "${livePrice}",
    "stopLoss": "[Calculate adaptive stop-loss level based on regime volatility]",
    "takeProfit": "[Calculate adaptive take-profit level based on regime volatility]",
    "reason": "[One sentence technical/sentiment tactical justification mentioning the detected ${marketRegime.regime} regime]"
  }`;

  try {
    console.log(`🧠 [DIAGNOSTIC] Sending prompt payload to AI Completions gateway...`);
    const resultText = await callUnifiedAI(agentBrainPrompt, `Current Asset: ${symbol}. Last Traded Price: $${livePrice}. Sentiment Brief: ${sentimentSummary}`);

    const trimmedResult = resultText.trim();
    console.log(`🧠 [DIAGNOSTIC] Gateway returned content length: ${trimmedResult.length} characters.`);

    if (!trimmedResult.includes("{") || !trimmedResult.includes("}")) {
      console.log(`⚪ [DIAGNOSTIC] AI response lacks structured brackets. Aborting.`);
      return null;
    }

    const proposal: any = extractShieldJson(resultText);

    // Size every proposal to a fixed ~$5 notional position, consistent with
    // the RiskGuardrail's $10 max trade size. This used to hardcode
    // "5.0000" units on the buy side — i.e. 5 whole BTC/ETH/SOL, not $5 of
    // it — which meant every autopilot buy attempted a wildly oversized
    // market order (worth thousands to hundreds of thousands of dollars)
    // instead of the intended small test position.
    const quantityNum = 5 / priceNum;
    proposal.quantity = quantityNum.toFixed(4);

    console.log(`🎯 [DIAGNOSTIC] Active TradeProposal resolved successfully for ${symbol}. Mapping parameters...`);
    return proposal as TradeProposal;
  } catch (error: any) {
    console.error("❌ [DIAGNOSTIC] Exception in Agentic decision matrix:", error.message);
    throw error; 
  }
}

// 4. Action Layer: Execute order on Bitget V2 API (Spot Market Order)
export async function executeApprovedTrade(proposal: TradeProposal): Promise<string> {
  const requestPath = '/api/v2/spot/trade/place-order';
  console.log(`🔍 [DIAGNOSTIC] Action check: Executing Spot Market Order for ${proposal.symbol}...`);
  
  const body = JSON.stringify({
    symbol: proposal.symbol,
    side: proposal.side, 
    orderType: 'market',
    size: proposal.quantity, 
    clientOid: `asiwaju_${Date.now()}` 
  });

  const headers = getBitgetHeaders('POST', requestPath, body);

  try {
    const response = await fetch('https://api.bitget.com' + requestPath, {
      method: 'POST',
      headers: headers,
      body: body
    });

    const result = await response.json();

    if (result.code === '00000' && result.data) {
      console.log(`🎯 [DIAGNOSTIC] Bitget Spot order accepted. Order ID: ${result.data.orderId}`);
      return `SUCCESS:${result.data.orderId}`;
    } else {
      console.error(`❌ [DIAGNOSTIC] Bitget order rejected: ${result.msg}`);
      return `FAILED:${result.msg}`;
    }
  } catch (error: any) {
    console.error("❌ [DIAGNOSTIC] Exception during order placement:", error.message);
    return `ERROR:${error.message || 'Connection timeout'}`;
  }
}

// 5. Autonomous Autopilot Layer: Scans, Analyzes, and Directly Executes
export async function runAutopilotExecution(specificCoin?: string): Promise<string> {
  // SAFETY KILL SWITCH: autopilot is OFF by default. It must be explicitly
  // enabled with AUTOPILOT_ENABLED=true. This is enforced here — the single
  // shared entry point used by the REST endpoint, the background 6-hour
  // loop, and the Telegram/Discord bot commands — so no caller can bypass
  // it. Added after a real incident where autopilot placed live buy orders
  // that were never automatically closed (see runPositionMonitorOnce below
  // for the accompanying take-profit/stop-loss enforcement this was
  // missing entirely). Re-enable only once you've reviewed
  // AUDIT_REPORT.md's autopilot incident entry and are comfortable with the
  // current guarantees.
  if (process.env.AUTOPILOT_ENABLED !== 'true') {
    const msg = 'AUTOPILOT_DISABLED: Autonomous execution is disabled by default as of this build. Set AUTOPILOT_ENABLED=true to opt in explicitly after reviewing AUDIT_REPORT.md.';
    console.warn(`🛑 [Autopilot] ${msg}`);
    return msg;
  }

  const coinsToScan = specificCoin ? [specificCoin.toUpperCase()] : ['BTC', 'SOL', 'ETH'];
  console.log(`🤖 [Autopilot] Commencing autonomous scan loop for: ${coinsToScan.join(', ')}...`);

  for (const coin of coinsToScan) {
    try {
      const proposal = await scanMarketOpportunity(coin);
      if (!proposal) {
        console.log(`🤖 [Autopilot] No clear setup for ${coin}. Continuing scan...`);
        continue;
      }

      console.log(`🤖 [Autopilot] Candidate setup found for ${coin}. Routing through Asiwaju Agent Shield before execution...`);

      // IMPORTANT: this MUST go through the same Shield pipeline as every
      // manually-approved trade (prompt safety, $10 sizing cap, symbol
      // whitelist, cooldown, re-entrancy/replay guards). This used to call
      // executeApprovedTrade() directly instead, skipping all of the above,
      // gated only by a hardcoded `confidenceScore = 9 >= 8` constant that
      // was never actually computed from anything — i.e. it always passed.
      const tradeRequest: TradeRequest = {
        symbol: proposal.symbol,
        side: proposal.side,
        price: parseFloat(proposal.price),
        quantity: parseFloat(proposal.quantity)
      };

      const shieldReport = await AsiwajuAgentShield.processSecureTrade(
        `Autonomous autopilot trade for ${proposal.symbol}: ${proposal.reason}`,
        tradeRequest,
        `autopilot_sig_${Date.now()}_${coin}`
      );

      if (shieldReport.success) {
        return `EXECUTED:${proposal.symbol}:${proposal.side.toUpperCase()}:${proposal.price}:${shieldReport.orderId}`;
      } else {
        console.log(`🤖 [Autopilot] Shield blocked ${coin}: ${shieldReport.message}. Continuing scan...`);
        continue;
      }
    } catch (error: any) {
      console.error(`❌ Exception during autopilot scan on ${coin}:`, error.message);
    }
  }

  return "NO_SETUP: All monitored assets are in ranging sideways markets, or were blocked by the Agent Shield. Execution safely aborted.";
}

// 6. Position Monitor: checks every open (tracked) position against its
// current live price and closes it if the stop-loss or take-profit has
// been hit. This is the piece that was missing entirely before: opening a
// trade with stopLoss/takeProfit numbers attached did not mean anything
// actually watched for those levels being reached. See src/utils/positions.ts
// for the full design notes and known limitations (in-memory only, not a
// substitute for exchange-native conditional orders).
export async function runPositionMonitorOnce(): Promise<string[]> {
  const closedSummaries: string[] = [];
  const positions = getOpenPositions();

  if (positions.length === 0) {
    return closedSummaries;
  }

  console.log(`📡 [Position Monitor] Checking ${positions.length} open position(s) against live prices...`);

  for (const position of positions) {
    try {
      const currentPriceStr = await getLivePrice(position.symbol);
      const currentPrice = parseFloat(currentPriceStr);

      if (isNaN(currentPrice) || currentPrice <= 0) {
        console.warn(`⚠️ [Position Monitor] Could not resolve a valid live price for ${position.symbol}. Skipping this cycle.`);
        continue;
      }

      const trigger = evaluateExitTrigger(position, currentPrice);
      if (!trigger) {
        continue;
      }

      console.log(`🎯 [Position Monitor] ${trigger} hit for ${position.symbol}: current $${currentPrice}, SL ${position.stopLoss}, TP ${position.takeProfit}. Closing position...`);

      const exitSide: 'buy' | 'sell' = position.side === 'buy' ? 'sell' : 'buy';
      const exitTradeRequest: TradeRequest = {
        symbol: position.symbol,
        side: exitSide,
        price: currentPrice,
        quantity: position.quantity
      };

      const shieldReport = await AsiwajuAgentShield.processSecureTrade(
        `Automatic ${trigger} exit for ${position.symbol} position (entry $${position.entryPrice}, opened ${new Date(position.openedAt).toISOString()}).`,
        exitTradeRequest,
        `exit_${trigger}_${position.id}`,
        /* isPositionExit */ true
      );

      if (shieldReport.success) {
        untrackPosition(position.id);
        const summary = `${trigger}:${position.symbol}:${shieldReport.orderId}`;
        console.log(`✅ [Position Monitor] Closed ${position.symbol} on ${trigger}. Order ID: ${shieldReport.orderId}`);
        closedSummaries.push(summary);
      } else {
        // Deliberately left tracked: we'll retry on the next monitoring
        // cycle rather than silently dropping a position that failed to
        // close (e.g. a transient exchange rejection).
        console.error(`❌ [Position Monitor] Failed to close ${position.symbol} on ${trigger} trigger: ${shieldReport.message}. Will retry next cycle.`);
      }
    } catch (error: any) {
      console.error(`❌ [Position Monitor] Exception while evaluating ${position.symbol}:`, error.message);
    }
  }

  return closedSummaries;
}