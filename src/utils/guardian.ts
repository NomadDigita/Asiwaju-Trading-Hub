import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';

interface TradeLog {
  timestamp: string;
  symbol: string;
  side: string;
  price: string;
  size: string;
  notes?: string;
}

// Simulated emotional trade log to demonstrate system audit logic on empty wallets or geoblocks
const MOCK_EMOTIONAL_LOG: TradeLog[] = [
  { timestamp: "1780000000000", symbol: "SOLUSDT", side: "buy", price: "188.50", size: "15", notes: "Bought at local peak after a massive green hourly candle (FOMO)" },
  { timestamp: "1780003600000", symbol: "SOLUSDT", side: "sell", price: "171.20", size: "15", notes: "Panic sold at a major loss during a temporary drop" },
  { timestamp: "1780005400000", symbol: "SOLUSDT", side: "buy", price: "179.00", size: "30", notes: "Immediately re-entered with double the position size to claw back losses (Revenge trading)" },
  { timestamp: "1780009000000", symbol: "SOLUSDT", side: "sell", price: "165.00", size: "30", notes: "Panic sold again at a larger loss as market continued down" }
];

function getBitgetHeaders(method: string, requestPath: string, body = ''): Record<string, string> {
  const apiKey = process.env.BITGET_API_KEY || '';
  const secretKey = process.env.BITGET_SECRET_KEY || '';
  const passphrase = process.env.BITGET_PASSPHRASE || '';

  const timestamp = Date.now().toString();
  const preHash = timestamp + method + requestPath + body;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(preHash)
    .digest('base64');

  return {
    'ACCESS-KEY': apiKey,
    'ACCESS-SIGN': signature,
    'ACCESS-TIMESTAMP': timestamp,
    'ACCESS-PASSPHRASE': passphrase,
    'locale': 'en-US',
    'Content-Type': 'application/json'
  };
}

export async function runBehavioralAudit(): Promise<string> {
  let trades: TradeLog[] = [];
  let isDemoMode = false;

  // Automatically bypass the US-blocked Bitget API if running in Vercel Serverless
  if (process.env.VERCEL) {
    console.log("🛰️ [Guardian] Vercel environment detected. Bypassing geoblocked handshake.");
    trades = MOCK_EMOTIONAL_LOG;
    isDemoMode = true;
  } else {
    const requestPath = '/api/v2/spot/trade/history-orders';
    const headers = getBitgetHeaders('GET', requestPath);

    try {
      // Attempt to pull real historical orders from Bitget with a strict 2-second timeout
      const response = await fetch('https://api.bitget.com' + requestPath + '?limit=10', {
        method: 'GET',
        headers: headers,
        signal: AbortSignal.timeout(2000)
      });

      const result = await response.json();

      if (result.code === '00000' && Array.isArray(result.data) && result.data.length > 0) {
        trades = result.data.map((order: any) => ({
          timestamp: order.cTime,
          symbol: order.symbol,
          side: order.side,
          price: order.price,
          size: order.size,
          notes: `Order status: ${order.status}`
        }));
      } else {
        trades = MOCK_EMOTIONAL_LOG;
        isDemoMode = true;
      }
    } catch (error) {
      console.warn("⚠️ Bitget API connection timed out. Falling back to Demo Audit Mode.");
      trades = MOCK_EMOTIONAL_LOG;
      isDemoMode = true;
    }
  }

  // Orchestrate the Behavioral Risk Audit via MuleRun
  const apiKey = process.env.MULERUN_API_KEY;
  if (!apiKey) throw new Error("MULERUN_API_KEY is missing from environment variables.");

  const auditPrompt = `You are the Lead Risk Auditor and Behavioral Trading Coach at Asiwaju AI Hub. 
  Your objective is to analyze a user's recent trade history logs, detect psychological flaws or behavioral mistakes, 
  and provide a rigorous structured coaching report.
  
  Examine the logs for:
  1. FOMO: Buying local highs on rapid green candles.
  2. Revenge Trading: Rapid, consecutive trades with increasing size after a loss.
  3. Over-Leveraging/Sizing: Large jumps in execution sizing with no technical reason.
  4. Panic Selling: Closing positions at local support levels.
  
  You MUST output in this exact markdown format:
  
  ## 🛡️ Asiwaju Portfolio Risk & Behavioral Audit
  ${isDemoMode ? "*⚠️ [DEMO MODE ACTIVE] No trade history found on-chain. Analyzing benchmark emotional trade patterns.*" : "*✅ [LIVE AUDIT] Analyzing your last 10 Bitget trades.*"}
  
  ### 📈 Behavioral Health Score: [X/100]
  [Provide a short, brutally honest evaluation of their discipline in 2 sentences]
  
  ### 🔍 Detected Psychological Biases:
  * **Biases Identified:** [e.g., Revenge Trading, FOMO, Loss Aversion]
  * **Critical Mistakes:** [Highlight the worst trade in the log and explain why it was psychologically flawed]
  
  ### 🎯 Core Coaching Adjustments:
  1. **[Adjustment Name]:** [1-sentence rule to fix bias 1]
  2. **[Adjustment Name]:** [1-sentence rule to fix bias 2]
  3. **[Adjustment Name]:** [1-sentence rule to fix bias 3]`;

  try {
    const response = await fetch('https://api.mulerun.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: auditPrompt },
          { role: 'user', content: `Analyze this trade log: ${JSON.stringify(trades, null, 2)}` }
        ],
        stream: false
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "Failed to generate risk audit.";
  } catch (error) {
    console.error("Error in behavioral audit loop:", error);
    throw error;
  }
}