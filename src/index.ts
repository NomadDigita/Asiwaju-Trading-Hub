// LINE 1: Force ES6 to load environment variables before hoisting any other modules
import 'dotenv/config';

import http from 'http';
import https from 'https';

// Import our bot controllers
import { bot, convertMarkdownToTelegramHtml } from './bot';
import { client } from './discord';

// Import our core utility modules (Unified ES6 Imports)
import { runAutopilotExecution } from './utils/agent';

// Global safeguards to prevent process crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Shield] Unhandled Rejection intercepted:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [Shield] Uncaught Exception intercepted:', err.message);
});

const PORT = process.env.PORT || 8080;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || "https://asiwaju-trading-hub.onrender.com";

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
    // 1. Committee Endpoint
    if (url.pathname === '/api/committee' && req.method === 'POST') {
      const { coin } = await getRequestBody(req);
      if (!coin) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: "Coin ticker is required." }));
      }
      const { runInvestmentCommittee } = require('./utils/committee');
      const report = await runInvestmentCommittee(coin);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ report }));
    }

    // 2. Portfolio Audit Endpoint
    if (url.pathname === '/api/audit' && req.method === 'POST') {
      const { runBehavioralAudit } = require('./utils/guardian');
      const report = await runBehavioralAudit();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ report }));
    }

    // 3. Strategy Compiler Endpoint
    if (url.pathname === '/api/strategy' && req.method === 'POST') {
      const { prompt } = await getRequestBody(req);
      if (!prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: "Strategy prompt is required." }));
      }
      const { generateStrategyAndBacktest } = require('./utils/lab');
      const report = await generateStrategyAndBacktest(prompt);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ report }));
    }

    // 4. Sentinel News Endpoint
    if (url.pathname === '/api/sentinel' && req.method === 'POST') {
      const { runNewsAudit } = require('./utils/sentinel');
      const report = await runNewsAudit();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ report }));
    }

    // 5. Agent Scan & Execute Endpoint
    if (url.pathname === '/api/agent') {
      if (req.method === 'GET') {
        const coin = url.searchParams.get("coin") || "SOL";
        const { scanMarketOpportunity } = require('./utils/agent');
        const proposal = await scanMarketOpportunity(coin);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(proposal || { message: "NO_SETUP" }));
      }
      if (req.method === 'POST') {
        const proposal = await getRequestBody(req);
        const { executeApprovedTrade } = require('./utils/agent');
        const executionResult = await executeApprovedTrade(proposal);
        const [status, details] = executionResult.split(':');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: status === 'SUCCESS', orderId: details }));
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

  // 2. Autonomous Portfolio Scanner Loop: Runs every 10 minutes to scan and auto-trade (Uses static ES6 imports)
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