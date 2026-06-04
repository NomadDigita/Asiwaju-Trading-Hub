// LINE 1: Force ES6 variables configuration
import 'dotenv/config';

import { Client, GatewayIntentBits } from 'discord.js';
import crypto from 'crypto';
import { runInvestmentCommittee } from './utils/committee';
import { runBehavioralAudit } from './utils/guardian';
import { generateStrategyAndBacktest } from './utils/lab';
import { runNewsAudit } from './utils/sentinel';
import { scanMarketOpportunity, executeApprovedTrade, runAutopilotExecution, TradeProposal } from './utils/agent';

// Import Shield SDK to secure Bot executions
import { AsiwajuAgentShield } from './infra/ShieldSDK';

// Verify Token
const discordToken = process.env.DISCORD_BOT_TOKEN;
if (!discordToken) {
  throw new Error("❌ Error: DISCORD_BOT_TOKEN is missing in .env");
}

// Initialize Client with necessary privileged intents
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const pendingProposals = new Map<string, TradeProposal>();
let isAutopilotOn = false;

// Helper: Safely splits and sends long Markdown payloads (handles 2000-character limit)
export async function sendDiscordSafeMessage(message: any, text: string) {
  const CHAR_LIMIT = 1900; // Leave buffer margin for formatting

  if (text.length <= CHAR_LIMIT) {
    return message.reply(text);
  }

  const lines = text.split('\n');
  let currentChunk = "";
  let inPreBlock = false;

  for (const line of lines) {
    if (line.includes('```')) {
      inPreBlock = !inPreBlock;
    }

    if (currentChunk.length + line.length + 15 > CHAR_LIMIT) {
      let sendText = currentChunk;
      if (inPreBlock) {
        sendText += '\n```';
      }

      await message.reply(sendText);
      currentChunk = inPreBlock ? '```python\n' : '';
    }

    currentChunk += line + '\n';
  }

  if (currentChunk.trim().length > 0) {
    await message.reply(currentChunk);
  }
}

// Secure signature generation for Bitget
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

// Client Startup Event
client.once('ready', () => {
  console.log(`🚀 Asiwaju Discord Companion Bot is online as ${client.user?.tag}`);
});

// Message Routing Listener
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();

  // 1. !balance Command
  if (content === '!balance') {
    message.reply("🛰️ Interrogating Bitget V2 API, please wait...");

    const requestPath = '/api/v2/spot/account/assets';
    const headers = getBitgetHeaders('GET', requestPath);

    try {
      const response = await fetch('https://api.bitget.com' + requestPath, {
        method: 'GET',
        headers: headers
      });

      const result = await response.json();

      if (result.code === '00000' && Array.isArray(result.data)) {
        const activeBalances = result.data.filter((asset: any) => parseFloat(asset.available) > 0);

        if (activeBalances.length === 0) {
          return message.reply("💰 Your Spot wallet is currently empty.");
        }

        let replyMessage = "📊 **Asiwaju Spot Portfolio Summary**\n\n";
        activeBalances.forEach((asset: any) => {
          const available = parseFloat(asset.available).toFixed(4);
          replyMessage += `• **${asset.coin}**: ${available}\n`;
        });

        await message.reply(replyMessage);
      } else {
        message.reply(`❌ Exchange Error: ${result.msg || 'Handshake failed'}`);
      }
    } catch (error) {
      console.error(error);
      message.reply("❌ Connection timeout. Check local proxy or network tunnel status.");
    }
  }

  // 2. !research Command (Investment Committee)
  if (content.startsWith('!research')) {
    const args = content.split(' ');
    const coin = args[1]?.trim();

    if (!coin) {
      return message.reply("❌ Error: Ticker missing. Format: `!research SOL` or `!research BTC`");
    }

    const coinUpper = coin.toUpperCase();
    message.reply(`🎬 Convening the Asiwaju AI Investment Committee to analyze ${coinUpper}...\nThis may take up to 15 seconds.`);

    try {
      const report = await runInvestmentCommittee(coinUpper);
      await sendDiscordSafeMessage(message, report);
    } catch (error) {
      console.error(error);
      message.reply(`❌ Error: ${(error as any).message || 'Failed to resolve committee.'}`);
    }
  }

  // 3. !audit Command (Anti-Liquidator)
  if (content === '!audit') {
    message.reply("🛡️ Fetching spot trade history and generating behavioral risk audit...");

    try {
      const report = await runBehavioralAudit();
      await sendDiscordSafeMessage(message, report);
    } catch (error) {
      console.error(error);
      message.reply(`❌ Error: ${(error as any).message || 'Failed to generate behavioral risk audit.'}`);
    }
  }

  // 4. !strategy Command (Strategy Compiler & Backtester)
  if (content.startsWith('!strategy')) {
    const args = content.split(' ');
    const strategyPrompt = args.slice(1).join(' ').trim();

    if (!strategyPrompt) {
      return message.reply("❌ Error: Strategy missing. Format: `!strategy Buy when RSI < 30, sell when price gains 4%`");
    }

    message.reply(`🧪 Translating strategy into quantitative code and running simulated backtest...`);

    try {
      const report = await generateStrategyAndBacktest(strategyPrompt);
      await sendDiscordSafeMessage(message, report);
    } catch (error) {
      console.error(error);
      message.reply(`❌ Error: ${(error as any).message || 'Failed to compile strategy.'}`);
    }
  }

  // 5. !news Command (Sentinel News Terminal)
  if (content === '!news') {
    message.reply("📡 Querying global macro headlines and generating market intelligence...");

    try {
      const report = await runNewsAudit();
      await sendDiscordSafeMessage(message, report);
    } catch (error) {
      console.error(error);
      message.reply(`❌ Error: ${(error as any).message || 'Failed to compile sentinel news audit.'}`);
    }
  }

  // 6. !trade Command (Autonomous Agent Trading Scan)
  if (content.startsWith('!trade')) {
    const args = content.split(' ');
    const coin = args[1]?.trim();

    if (!coin) {
      return message.reply("❌ Error: Ticker missing. Format: `!trade SOL` or `!trade BTC`");
    }

    const coinUpper = coin.toUpperCase();
    message.reply(`🤖 Asiwaju AI Agent is scanning market conditions & reading charts for ${coinUpper}...`);

    try {
      const proposal = await scanMarketOpportunity(coinUpper);
      if (!proposal) {
        return message.reply(`⚪ Market ranging. No high-probability setups located for ${coinUpper} at this time.`);
      }

      // Save proposal in user guild memory
      pendingProposals.set(message.author.id, proposal);

      const replyText = `🎯 **AI Trading Agent Signal Located!** 🎯\n\n` +
        `• **Asset:** ${proposal.symbol}\n` +
        `• **Direction:** ${proposal.side.toUpperCase()}\n` +
        `• **Price:** $${parseFloat(proposal.price).toFixed(2)}\n` +
        `• **Quantity:** ${proposal.quantity}\n` +
        `• **Take Profit Target:** $${parseFloat(proposal.takeProfit).toFixed(2)}\n` +
        `• **Stop Loss Invalidation:** $${parseFloat(proposal.stopLoss).toFixed(2)}\n\n` +
        `• **Justification:** ${proposal.reason}\n\n` +
        `⚡ **Awaiting Permission:** Reply with \`!approve\` to execute this trade on Bitget!`;

      await sendDiscordSafeMessage(message, replyText);
    } catch (error) {
      console.error(error);
      message.reply("❌ Failed to complete scan. Check the agentic gateway logs.");
    }
  }

  // 7. !approve Command (Autonomous Agent Trading Execution secured via AAS SDK)
  if (content === '!approve') {
    const proposal = pendingProposals.get(message.author.id);

    if (!proposal) {
      return message.reply("❌ Error: No pending trade proposal found. Run `!trade <coin>` first to scan.");
    }

    message.reply(`⚡ Permission granted. Initializing Asiwaju Agent Shield SDK pipeline on-server...`);

    try {
      const tradeRequest = {
        symbol: proposal.symbol,
        side: proposal.side as 'buy' | 'sell',
        price: parseFloat(proposal.price),
        quantity: parseFloat(proposal.quantity)
      };

      // Execute through the official secure Shield SDK pipeline (No bypass)
      const shieldReport = await AsiwajuAgentShield.processSecureTrade(
        proposal.reason,
        tradeRequest,
        `discord_sig_${Date.now()}` // Generate secure unique signature nonce
      );

      let logsMessage = "🔒 **Asiwaju Agent Shield Security Report**\n\n";
      shieldReport.logs.forEach((logLine: string) => {
        logsMessage += `• ${logLine}\n`;
      });

      if (shieldReport.success) {
        logsMessage += `\n🎯 **Trade Executed Live!**\nOrder ID: \`${shieldReport.orderId}\``;
        pendingProposals.delete(message.author.id); // Clear proposal memory on success
      } else {
        logsMessage += `\n❌ **AAS Shield BLOCKED:** ${shieldReport.message}`;
      }

      await sendDiscordSafeMessage(message, logsMessage);
    } catch (error: any) {
      console.error(error);
      message.reply(`❌ Handshake timeout or exception: ${error.message || 'Transaction rejected.'}`);
    }
  }

  // 8. !autopilot Command (Autonomous Autopilot Trading Toggle)
  if (content.startsWith('!autopilot')) {
    const args = content.split(' ');
    const coin = args[1]?.trim(); // Optional coin parameter

    isAutopilotOn = !isAutopilotOn;

    if (isAutopilotOn) {
      message.reply(`🤖 [Autopilot] Mode ENGAGED. Commencing active market monitoring on ${coin ? coin.toUpperCase() : 'Core Portfolio Whitelist (BTC, SOL, ETH)'}...`);
      try {
        const result = await runAutopilotExecution(coin);
        const [status, symbol, side, price, details] = result.split(":");

        if (status === "EXECUTED") {
          const replyText = `🎯 **Autopilot Trade Executed Live!** 🎯\n\n` +
            `• **Asset:** ${symbol}\n` +
            `• **Direction:** ${side}\n` +
            `• **Execution Price:** $${parseFloat(price).toFixed(2)}\n` +
            `• **Bitget Order ID:** \`${details}\` [4]`;
          await sendDiscordSafeMessage(message, replyText);
        } else {
          message.reply(`🤖 [Autopilot] Scan complete. Safety abort status: ${result}`);
        }
      } catch (error) {
        console.error(error);
        message.reply("❌ Exception during autopilot execution loop.");
      }
    } else {
      message.reply("🤖 [Autopilot] Mode DISENGAGED. Reverting to manual approval.");
    }
  }
});

// Log Client In with safe error catching
client.login(discordToken)
  .then(() => console.log("🚀 Asiwaju Discord Companion Bot is active and listening..."))
  .catch((err) => console.error("⚠️ Discord Bot failed to start:", err.message));