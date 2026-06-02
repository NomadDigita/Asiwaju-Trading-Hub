// LINE 1: Force ES6 to load environment variables before hoisting any other modules
import 'dotenv/config';

import http from 'http';
import https from 'https';
import crypto from 'crypto';

// Import our bot controllers
import { bot, convertMarkdownToTelegramHtml } from './bot';
import { client } from './discord';

// Import our core utility modules (Strict ES6 Imports - No raw require blocks)
import { runAutopilotExecution, scanMarketOpportunity, executeApprovedTrade } from './utils/agent';
import { runInvestmentCommittee } from './utils/committee';
import { runBehavioralAudit } from './utils/guardian';
import { generateStrategyAndBacktest } from './utils/lab';
import { runNewsAudit } from './utils/sentinel';
import { callUnifiedAI } from './utils/ai';

// Import Shield SDK to validate and secure manual web-dashboard orders
import { AsiwajuAgentShield } from './infra/ShieldSDK';

// Global safeguards to prevent process crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Shield] Unhandled Rejection intercepted:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [Shield] Uncaught Exception intercepted:', err.message);
});

const PORT = process.env.PORT || 8080;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || "https://asiwaju-trading-hub.onrender.com";

// Helper: Safely parses JSON boundaries inside AI responses
function sanitizeAndParseJson(rawText: string): any {
  let cleanText = rawText
    .replace(/^\`\`\`(json)?\n/, '')
    .replace(/\`\`\`$/, '')
    .trim();

  const startIdx = cleanText.indexOf('{');
  const endIdx = cleanText.lastIndexOf('}');

  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`JSON Boundaries Missing. Raw: ${rawText.slice(0, 100)}`);
  }

  const jsonString = cleanText.slice(startIdx, endIdx + 1);
  return JSON.parse(jsonString);
}

// Helper to parse JSON request body in raw HTTP server
async function getRequestBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', err => reject(err));
  });
}

// Secure signature generation for Bitget API queries
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

// Simulated emotional trade log to demonstrate system audit logic on empty wallets or geoblocks
const MOCK_EMOTIONAL_LOG = [
  { timestamp: "1780000000000", symbol: "SOLUSDT", side: "buy", price: "188.50", size: "15", notes: "Bought at local peak after a massive green hourly candle (FOMO)" },
  { timestamp: "1780003600000", symbol: "SOLUSDT", side: "sell", price: "171.20", size: "15", notes: "Panic sold at a major loss during a temporary drop" },
  { timestamp: "1780005400000", symbol: "SOLUSDT", side: "buy", price: "179.00", size: "30", notes: "Immediately re-entered with double the position size to claw back losses (Revenge trading)" },
  { timestamp: "1780009000000", symbol: "SOLUSDT", side: "sell", price: "165.00", size: "30", notes: "Panic sold again at a larger loss as market continued down" }
];

const MOCK_NEWS_FEED = [
  { source: "Bloomberg", headline: "Fed hints at potential rate cuts in upcoming Q3 meeting as inflation cools.", category: "Macro" },
  { source: "Coindesk", headline: "Solana daily active wallets hit new record high amid meme coin volume surge.", category: "Crypto" },
  { source: "Reuters", headline: "Major US investment bank files for spot Solana ETF, citing high institutional demand.", category: "Regulation" }
];

// Create CORS-enabled API Server to handle Web Dashboard requests
const server = http.createServer(async (req, res) => {
  // Set standard CORS headers to allow Vercel browser connections
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url || '', `http://${req.headers.host}`);

  try {
    // 1. Committee Endpoint (Returns structured JSON)
    if (url.pathname === '/api/committee' && req.method === 'POST') {
      const { coin } = await getRequestBody(req);
      if (!coin) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: "Coin ticker is required." }));
      }

      const systemPrompt = `You are the Chairman of the Asiwaju AI Investment Committee.
      Analyze the coin: ${coin.toUpperCase()}.
      You MUST respond in this exact JSON format (and absolutely no other conversational wrapper or markdown syntax):
      {
        "rating": "BUY, SELL, or HOLD",
        "score": "X/10",
        "trigger": "One clear price level or signal to wait for before acting",
        "tech": "Focused technical analyst view in 2 sentences",
        "risk": "Risk manager warning in 2 sentences",
        "chain": "On-chain activity view in 2 sentences",
        "debate": "Consensus debate synthesis in 3 sentences",
        "reasoning": "Step-by-step proof of reasoning logs in 4 lines"
      }`;

      const rawReport = await callUnifiedAI(systemPrompt, `Run consensus audit for ${coin.toUpperCase()}`);
      const parsed = sanitizeAndParseJson(rawReport);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(parsed));
    }

    // 2. Portfolio Audit Endpoint (Returns structured JSON based on live data)
    if (url.pathname === '/api/audit' && req.method === 'POST') {
      let tradeLogPayload = "";

      try {
        // Interrogate Bitget Spot account trade history directly
        const requestPath = '/api/v2/spot/trade/history-orders?limit=10';
        const headers = getBitgetHeaders('GET', requestPath);
        
        const response = await fetch('https://api.bitget.com' + requestPath, {
          method: 'GET',
          headers: headers
        });

        const result = await response.json();

        if (result.code === '00000' && Array.isArray(result.data) && result.data.length > 0) {
          tradeLogPayload = JSON.stringify(result.data);
          console.log("🛡️ [Guardian] Successfully retrieved live portfolio records.");
        } else {
          console.warn("🛡️ [Guardian] Spot order history empty or geoblocked. Engaging adaptive baseline log.");
          tradeLogPayload = JSON.stringify(MOCK_EMOTIONAL_LOG);
        }
      } catch (err: any) {
        console.warn("🛡️ [Guardian] Bitget API handshake exception:", err.message);
        tradeLogPayload = JSON.stringify(MOCK_EMOTIONAL_LOG);
      }

      const systemPrompt = `You are the Lead Risk Auditor and Behavioral Trading Coach at Asiwaju AI Hub.
      Analyze the user's trading log.
      You MUST respond in this exact JSON format (and absolutely no other conversational wrapper or markdown syntax):
      {
        "score": 25,
        "evaluation": "Sincere behavioral evaluation in 2 sentences",
        "biases": ["FOMO", "Revenge Trading", "Panic Selling"],
        "criticalMistake": "Describe the worst transaction mistake in 1 sentence",
        "adjustments": [
          { "title": "Planning", "desc": "Pre-trade adjustments description in 1 sentence" },
          { "title": "Cool-Off", "desc": "Mandatory cool-off rule description in 1 sentence" },
          { "title": "Sizing", "desc": "Fixed sizing rule description in 1 sentence" }
        ]
      }`;

      const rawReport = await callUnifiedAI(systemPrompt, `Analyze this trade log: ${tradeLogPayload}`);
      const parsed = sanitizeAndParseJson(rawReport);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(parsed));
    }

    // 3. Strategy Compiler Endpoint (Returns structured JSON)
    if (url.pathname === '/api/strategy' && req.method === 'POST') {
      const { prompt } = await getRequestBody(req);
      if (!prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: "Strategy prompt is required." }));
      }

      const systemPrompt = `You are the Chief Quantitative Strategist and Code Compiler at Asiwaju AI Hub.
      Translate the user's plain English strategy into Python code.
      You MUST respond in this exact JSON format (and absolutely no other conversational wrapper or markdown syntax):
      {
        "translation": "Sincere strategy parameters translation in 2 sentences",
        "code": "import pandas as pd\\n# Fully working Python backtesting code here",
        "winRate": "50.0%",
        "trades": "12",
        "pnl": "+12.4%",
        "drawdown": "-3.2%",
        "factor": "1.8",
        "verdict": "Risk analyst verdict in 2 sentences"
      }`;

      const rawReport = await callUnifiedAI(systemPrompt, `Compile and simulate: ${prompt}`);
      const parsed = sanitizeAndParseJson(rawReport);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(parsed));
    }

    // 4. Sentinel News Endpoint (Returns live macro sentiment JSON)
    if (url.pathname === '/api/sentinel' && req.method === 'POST') {
      let activeNewsPayload = "";

      try {
        // Fetch active news headlines directly from CryptoCompare's public API
        const response = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
        const result = await response.json();

        if (result && Array.isArray(result.Data) && result.Data.length > 0) {
          const mappedNews = result.Data.slice(0, 5).map((article: any) => ({
            source: article.source_info?.name || "Global Feed",
            headline: article.title,
            category: article.categories || "Crypto"
          }));
          activeNewsPayload = JSON.stringify(mappedNews);
          console.log("📡 [Sentinel] Successfully fetched live CryptoCompare headlines.");
        } else {
          activeNewsPayload = JSON.stringify(MOCK_NEWS_FEED);
        }
      } catch (err: any) {
        console.warn("⚠️ [Sentinel] News fetch failed, using fallback:", err.message);
        activeNewsPayload = JSON.stringify(MOCK_NEWS_FEED);
      }

      const systemPrompt = `You are the Chief Intelligence Officer and Sentinel News Analyst at Asiwaju AI Hub.
      Analyze the news feed.
      You MUST respond in this exact JSON format (and absolutely no other conversational wrapper or markdown syntax):
      {
        "index": 92,
        "rating": "Extreme FOMO, Extreme FUD, or Neutral",
        "macro": "Macro analysis summary in 2 sentences",
        "drivers": [
          { "event": "Event 1 Name", "desc": "Impact description in 1 sentence" },
          { "event": "Event 2 Name", "desc": "Impact description in 1 sentence" },
          { "event": "Event 3 Name", "desc": "Impact description in 1 sentence" }
        ],
        "tactical": "Tactical trading suggestions in 2 sentences"
      }`;

      const rawReport = await callUnifiedAI(systemPrompt, `Analyze this news feed: ${activeNewsPayload}`);
      const parsed = sanitizeAndParseJson(rawReport);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(parsed));
    }

    // 5. Agent Scan & Execute Endpoint (Protected via AAS SDK pipeline)
    if (url.pathname === '/api/agent') {
      if (req.method === 'GET') {
        const coin = url.searchParams.get("coin") || "SOL";
        const proposal = await scanMarketOpportunity(coin);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(proposal || { message: "NO_SETUP" }));
      }
      
      if (req.method === 'POST') {
        const proposal = await getRequestBody(req);

        if (!proposal || !proposal.symbol) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: "Invalid trade proposal payload." }));
        }

        // Map TradeProposal strings to numeric TradeRequest format expected by the Shield SDK
        const tradeRequest = {
          symbol: proposal.symbol,
          side: proposal.side as 'buy' | 'sell',
          price: parseFloat(proposal.price),
          quantity: parseFloat(proposal.quantity)
        };

        // Secure trade execution using the Asiwaju Agent Shield SDK pipeline
        const shieldReport = await AsiwajuAgentShield.processSecureTrade(
          proposal.reason || "Execute manual web-dashboard approved transaction.",
          tradeRequest,
          `web_sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // Generate nonce transaction signature
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: shieldReport.success,
          promptSafety: shieldReport.promptSafety,
          riskGuardrail: shieldReport.riskGuardrail,
          orderId: shieldReport.orderId || null,
          error: shieldReport.success ? undefined : shieldReport.message
        }));
      }
    }

    // 6. Autopilot Execution Endpoint (Prevents client-side JSON parsing failures)
    if (url.pathname === '/api/autopilot' && req.method === 'POST') {
      const { coin } = await getRequestBody(req);
      const result = await runAutopilotExecution(coin);
      const [status, symbol, side, price, details] = result.split(':');

      if (status === 'EXECUTED') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ 
          success: true, 
          message: `Autopilot execution succeeded for ${symbol}`, 
          orderId: details 
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ 
          success: false, 
          message: result 
        }));
      }
    }

    // Default route
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Asiwaju Unified API Server & Companion Bots are operational.\n');

  } catch (error: any) {
    console.error(`API Server Error on path ${url.pathname}:`, error.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message || "Internal Server Error" }));
  }
});

server.listen(PORT, () => {
  console.log(`📡 Render API Server active on port ${PORT}. Bots are operational.`);

  // 1. Keep-Alive Loop: Executes a request every 10 minutes to prevent Render free-tier sleeping
  setInterval(() => {
    if (RENDER_URL) {
      console.log(`🛰️ Keep-Alive: Pinging self at ${RENDER_URL}...`);
      https.get(RENDER_URL, (res) => {
        console.log(`🛰️ Keep-Alive: Self-ping acknowledged. Status Code: ${res.statusCode}`);
      }).on('error', (err) => {
        console.error(`⚠️ Keep-Alive: Self-ping failed:`, err.message);
      });
    }
  }, 10 * 60 * 1000);

  // 2. Autonomous Portfolio Scanner Loop: Runs every 10 minutes to scan and auto-trade
  setInterval(async () => {
    console.log("🤖 [Autopilot] Triggering background portfolio scan cycle...");
    try {
      const result = await runAutopilotExecution();
      const [status, symbol, side, price, details] = result.split(":");

      if (status === "EXECUTED") {
        const messageText = `🎯 **[AUTOPILOT EXECUTION ALERT]** 🎯\n\n` +
          `• **Asset:** ${symbol}\n` +
          `• **Direction:** ${side}\n` +
          `• **Execution Price:** $${parseFloat(price).toFixed(2)}\n` +
          `• **Bitget Order ID:** \`${details}\` [4]`;

        console.log(`🤖 [Autopilot] Order executed. Broadcasting push alerts...`);

        // A. Telegram Alert
        try {
          const formattedTgMessage = convertMarkdownToTelegramHtml(messageText);
          await bot.telegram.sendMessage(6582793388, formattedTgMessage, { parse_mode: 'HTML' });
        } catch (tgErr: any) {
          console.error("⚠️ Failed to send Telegram alert:", tgErr.message);
        }

        // B. Discord Alert
        try {
          const generalChannel = client.channels.cache.find((c: any) => c.name === 'general');
          if (generalChannel && 'send' in generalChannel) {
            await (generalChannel as any).send(messageText);
          }
        } catch (dcErr: any) {
          console.error("⚠️ Failed to send Discord alert:", dcErr.message);
        }
      } else {
        console.log(`🤖 [Autopilot] Scan complete. Safety outcome: ${result}`);
      }
    } catch (error: any) {
      console.error("❌ Exception during background autopilot scan:", error.message);
    }
  }, 10 * 60 * 1000);
});