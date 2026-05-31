import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import https from 'https';

// Import our self-executing bot controllers
import { bot, convertMarkdownToTelegramHtml, sendSafeHtmlMessage } from './bot';
import { client, sendDiscordSafeMessage } from './discord';
import { runAutopilotExecution } from './utils/agent';

const PORT = process.env.PORT || 8080;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || "https://asiwaju-trading-hub.onrender.com";

// Create dummy HTTP server to satisfy Render's port-binding checks
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Asiwaju AI Companion Bots are active and listening.\n');
});

server.listen(PORT, () => {
  console.log(`📡 Render Port-Binding established on port ${PORT}. Bots are operational.`);

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
  }, 10 * 60 * 1000); // 10 minutes in milliseconds

  // 2. Autonomous Portfolio Scanner Loop: Runs every 10 minutes to scan and auto-trade
  setInterval(async () => {
    console.log("🤖 [Autopilot] Triggering background portfolio scan cycle...");
    try {
      // Execute the multi-asset scanning autopilot
      const result = await runAutopilotExecution();
      const [status, symbol, side, price, details] = result.split(":");

      if (status === "EXECUTED") {
        const messageText = `🎯 **[AUTOPILOT EXECUTION ALERT]** 🎯\n\n` +
          `• **Asset:** ${symbol}\n` +
          `• **Direction:** ${side}\n` +
          `• **Execution Price:** $${parseFloat(price).toFixed(2)}\n` +
          `• **Bitget Order ID:** \`${details}\` [4]`;

        console.log(`🤖 [Autopilot] Order executed. Broadcasting push alerts to Telegram and Discord...`);

        // A. Push Alert to Telegram Chat ID: 6582793388
        try {
          const formattedTgMessage = convertMarkdownToTelegramHtml(messageText);
          await bot.telegram.sendMessage(6582793388, formattedTgMessage, { parse_mode: 'HTML' });
        } catch (tgErr: any) {
          console.error("⚠️ Failed to send Telegram push alert:", tgErr.message);
        }

        // B. Push Alert to Discord #general Channel
        try {
          const generalChannel = client.channels.cache.find((c: any) => c.name === 'general');
          if (generalChannel && 'send' in generalChannel) {
            await (generalChannel as any).send(messageText);
          }
        } catch (dcErr: any) {
          console.error("⚠️ Failed to send Discord push alert:", dcErr.message);
        }
      } else {
        console.log(`🤖 [Autopilot] Scan complete. Safety outcome: ${result}`);
      }
    } catch (error: any) {
      console.error("❌ Exception during background autopilot scan:", error.message);
    }
  }, 10 * 60 * 1000); // 10 minutes in milliseconds
});