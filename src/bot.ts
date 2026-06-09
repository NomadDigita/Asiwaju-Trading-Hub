// LINE 1: Force ES6 variables configuration
import 'dotenv/config';

import { Telegraf, Markup } from 'telegraf';
import crypto from 'crypto';
import { runInvestmentCommittee } from './utils/committee';
import { runBehavioralAudit } from './utils/guardian';
import { generateStrategyAndBacktest } from './utils/lab';
import { runNewsAudit } from './utils/sentinel';
import { scanMarketOpportunity, executeApprovedTrade, runAutopilotExecution, TradeProposal } from './utils/agent';

// Import Shield SDK to secure Bot executions
import { AsiwajuAgentShield } from './infra/ShieldSDK';

// Verify Bot Token
const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  throw new Error("❌ Error: TELEGRAM_BOT_TOKEN is missing in .env");
}

export const bot = new Telegraf(botToken);

const pendingProposals = new Map<number, TradeProposal>();
let isAutopilotOn = false;

// Helper to escape raw HTML special characters
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Convert standard Markdown output to safe Telegram HTML
export function convertMarkdownToTelegramHtml(markdown: string): string {
  const parts = markdown.split(/(\`\`\`[\s\S]*?\`\`\`)/g);

  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith('```')) {
      const code = parts[i]
        .replace(/^\`\`\`(python|javascript|typescript|json)?\n/, '').replace(/\`\`\`$/, '');
      parts[i] = `<pre>${escapeHtml(code)}</pre>`;
    } else {
      let text = escapeHtml(parts[i]);
      
      text = text.replace(/^#+\s*(.*)$/gm, '<b>$1</b>');
      text = text.replace(/\*\*(.*?)\*\"/g, '<b>$1</b>');
      text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      text = text.replace(/\`(.*?)\`/g, '<code>$1</code>');
      
      parts[i] = text;
    }
  }

  return parts.join('');
}

// Automatically splits messages exceeding Telegram's 4096-character limit
export async function sendSafeHtmlMessage(ctx: any, htmlText: string) {
  const CHAR_LIMIT = 3800;

  if (htmlText.length <= CHAR_LIMIT) {
    return ctx.reply(htmlText, { parse_mode: 'HTML' });
  }

  const lines = htmlText.split('\n');
  let currentChunk = "";
  let inPreBlock = false;

  for (const line of lines) {
    if (line.includes('<pre>')) inPreBlock = true;
    if (line.includes('</pre>')) inPreBlock = false;

    if (currentChunk.length + line.length + 20 > CHAR_LIMIT) {
      let sendText = currentChunk;
      if (inPreBlock) {
        sendText += '</pre>';
      }

      await ctx.reply(sendText, { parse_mode: 'HTML' });
      currentChunk = inPreBlock ? '<pre>' : '';
    }

    currentChunk += line + '\n';
  }

  if (currentChunk.trim().length > 0) {
    await ctx.reply(currentChunk, { parse_mode: 'HTML' });
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

// Helper: Performs a live portfolio balance lookup
async function fetchBitgetBalances(): Promise<string> {
  const requestPath = '/api/v2/spot/account/assets';
  const headers = getBitgetHeaders('GET', requestPath);

  const response = await fetch('https://api.bitget.com' + requestPath, {
    method: 'GET',
    headers: headers
  });

  const result = await response.json();

  if (result.code === '00000' && Array.isArray(result.data)) {
    const activeBalances = result.data.filter((asset: any) => parseFloat(asset.available) > 0);

    if (activeBalances.length === 0) {
      return "💰 Your Spot wallet is currently empty.";
    }

    let message = "📊 *Asiwaju Spot Portfolio Summary*\n\n";
    activeBalances.forEach((asset: any) => {
      const available = parseFloat(asset.available).toFixed(4);
      message += `• *${asset.coin}*: ${available}\n`;
    });
    return message;
  } else {
    throw new Error(result.msg || "Bitget Asset query failed.");
  }
}

// 1. Start Command (Launches with Custom Persistent Reply Keyboard)
bot.start((ctx) => {
  ctx.reply(
    "🦅 Welcome to Asiwaju AI Hub Command Center!\n\n" +
    "Use our custom menu buttons below or type prefix commands to navigate.",
    Markup.keyboard([
      ['📊 Research SOL', '🛡️ Behavioral Audit'],
      ['📡 Sentiment News', '💰 Spot Balance'],
      ['🤖 Trade SOL', '⚡ Approve Trade']
    ]).resize() // Resizes layout perfectly for mobile screens
  );
});

// 2. Interactive Menu Custom Button Handlers (Captured viahears)
bot.hears('📊 Research SOL', async (ctx) => {
  ctx.reply("🎬 Convening the Asiwaju AI Investment Committee to analyze SOL...\nThis may take up to 15 seconds.");
  try {
    const report = await runInvestmentCommittee("SOL");
    await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(report));
  } catch (error: any) {
    ctx.reply(`❌ Error: ${error.message || 'Failed to generate committee report.'}`);
  }
});

bot.hears('🛡️ Behavioral Audit', async (ctx) => {
  ctx.reply("🛡️ Fetching spot trade history and generating behavioral risk audit...");
  try {
    const report = await runBehavioralAudit();
    await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(report));
  } catch (error: any) {
    ctx.reply(`❌ Error: ${error.message || 'Failed to generate behavioral risk audit.'}`);
  }
});

bot.hears('📡 Sentiment News', async (ctx) => {
  ctx.reply("📡 Querying global macro headlines and generating market intelligence...");
  try {
    const report = await runNewsAudit();
    await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(report));
  } catch (error: any) {
    ctx.reply(`❌ Error: ${error.message || 'Failed to compile sentinel news audit.'}`);
  }
});

bot.hears('💰 Spot Balance', async (ctx) => {
  ctx.reply("🛰️ Interrogating Bitget V2 API, please wait...");
  try {
    const balance = await fetchBitgetBalances();
    await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(balance));
  } catch (error: any) {
    ctx.reply(`❌ Exchange Error: ${error.message || 'Handshake failed'}`);
  }
});

bot.hears('🤖 Trade SOL', async (ctx) => {
  ctx.reply("🤖 Asiwaju AI Agent is scanning market conditions & reading charts for SOL...");
  try {
    const proposal = await scanMarketOpportunity("SOL");
    if (!proposal) {
      return ctx.reply(`⚪ Market ranging. No high-probability setups located for SOL at this time.`);
    }

    pendingProposals.set(ctx.chat.id, proposal);

    const message = `🎯 **AI Trading Agent Signal Located!** 🎯\n\n` +
      `• **Asset:** ${proposal.symbol}\n` +
      `• **Direction:** ${proposal.side.toUpperCase()}\n` +
      `• **Price:** $${parseFloat(proposal.price).toFixed(2)}\n` +
      `• **Quantity:** ${proposal.quantity}\n` +
      `• **Take Profit Target:** $${parseFloat(proposal.takeProfit).toFixed(2)}\n` +
      `• **Stop Loss Invalidation:** $${parseFloat(proposal.stopLoss).toFixed(2)}\n\n` +
      `📝 **Justification:** ${proposal.reason}\n\n` +
      `⚡ **Awaiting Permission:** Click the '⚡ Approve Trade' button to execute this trade on Bitget!`;

    await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(message));
  } catch (error: any) {
    ctx.reply(`❌ Failed to complete scan: ${error.message}`);
  }
});

bot.hears('⚡ Approve Trade', async (ctx) => {
  const proposal = pendingProposals.get(ctx.chat.id);

  if (!proposal) {
    return ctx.reply("❌ Error: No pending trade proposal found. Click '🤖 Trade SOL' first to scan.");
  }

  ctx.reply(`⚡ Permission granted. Initializing Asiwaju Agent Shield SDK pipeline on-server...`);

  try {
    const tradeRequest = {
      symbol: proposal.symbol,
      side: proposal.side as 'buy' | 'sell',
      price: parseFloat(proposal.price),
      quantity: parseFloat(proposal.quantity)
    };

    // Execute through secure Shield SDK pipeline
    const shieldReport = await AsiwajuAgentShield.processSecureTrade(
      proposal.reason,
      tradeRequest,
      `telegram_sig_${Date.now()}` // Generate unique signature nonce
    );

    let logsMessage = "🔒 *Asiwaju Agent Shield Security Report*\n\n";
    shieldReport.logs.forEach((logLine: string) => {
      logsMessage += `• ${logLine}\n`;
    });

    if (shieldReport.success) {
      logsMessage += `\n🎯 **Trade Executed Live!**\nOrder ID: \`${shieldReport.orderId}\``;
      pendingProposals.delete(ctx.chat.id); // Clear proposal memory on success
    } else {
      logsMessage += `\n❌ **AAS Shield BLOCKED:** ${shieldReport.message}`;
    }

    await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(logsMessage));
  } catch (error: any) {
    ctx.reply(`❌ Handshake timeout or exception: ${error.message || 'Transaction rejected.'}`);
  }
});

// 3. Centralized Bot Commands List (Prefix fallbacks)
bot.command('balance', async (ctx) => {
  ctx.reply("🛰️ Interrogating Bitget V2 API, please wait...");
  try {
    const balance = await fetchBitgetBalances();
    await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(balance));
  } catch (error: any) {
    ctx.reply(`❌ Exchange Error: ${error.message || 'Handshake failed'}`);
  }
});

bot.command('research', async (ctx) => {
  const messageText = ctx.message?.text || '';
  const args = messageText.split(' ');
  const coin = args[1]?.trim();

  if (!coin) {
    return ctx.reply("❌ Error: Ticker missing. Format: `/research SOL` or `/research BTC`", { parse_mode: 'Markdown' });
  }

  const coinUpper = coin.toUpperCase();
  ctx.reply(`🎬 Convening the Asiwaju AI Investment Committee to analyze ${coinUpper}...\nThis may take up to 15 seconds.`);

  try {
    const report = await runInvestmentCommittee(coinUpper);
    await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(report));
  } catch (error: any) {
    ctx.reply(`❌ Error: ${error.message || 'Failed to generate committee report.'}`);
  }
});

bot.command('audit', async (ctx) => {
  ctx.reply("🛡️ Fetching spot trade history and generating behavioral risk audit...");
  try {
    const report = await runBehavioralAudit();
    await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(report));
  } catch (error: any) {
    ctx.reply(`❌ Error: ${error.message || 'Failed to generate behavioral risk audit.'}`);
  }
});

bot.command('strategy', async (ctx) => {
  const messageText = ctx.message?.text || '';
  const args = messageText.split(' ');
  const strategyPrompt = args.slice(1).join(' ').trim();

  if (!strategyPrompt) {
    return ctx.reply("❌ Error: Strategy missing. Format: `/strategy Buy when RSI < 30, sell when price gains 4%`", { parse_mode: 'Markdown' });
  }

  ctx.reply(`🧪 Translating strategy into quantitative code and running simulated backtest...`);

  try {
    const report = await generateStrategyAndBacktest(strategyPrompt);
    await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(report));
  } catch (error: any) {
    ctx.reply(`❌ Error: ${error.message || 'Failed to compile strategy.'}`);
  }
});

bot.command('news', async (ctx) => {
  ctx.reply("📡 Querying global macro headlines and generating market intelligence...");
  try {
    const report = await runNewsAudit();
    await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(report));
  } catch (error: any) {
    ctx.reply(`❌ Error: ${error.message || 'Failed to compile sentinel news audit.'}`);
  }
});

bot.command('trade', async (ctx) => {
  const messageText = ctx.message?.text || '';
  const args = messageText.split(' ');
  const coin = args[1]?.trim();

  if (!coin) {
    return ctx.reply("❌ Error: Ticker missing. Format: `/trade SOL` or `/trade BTC`", { parse_mode: 'Markdown' });
  }

  const coinUpper = coin.toUpperCase();
  ctx.reply(`🤖 Asiwaju AI Agent is scanning market conditions & reading charts for ${coinUpper}...`);

  try {
    const proposal = await scanMarketOpportunity(coinUpper);
    if (!proposal) {
      return ctx.reply(`⚪ Market ranging. No high-probability setups located for ${coinUpper} at this time.`);
    }

    pendingProposals.set(ctx.chat.id, proposal);

    const message = `🎯 **AI Trading Agent Signal Located!** 🎯\n\n` +
      `• **Asset:** ${proposal.symbol}\n` +
      `• **Direction:** ${proposal.side.toUpperCase()}\n` +
      `• **Price:** $${parseFloat(proposal.price).toFixed(2)}\n` +
      `• **Quantity:** ${proposal.quantity}\n` +
      `• **Take Profit Target:** $${parseFloat(proposal.takeProfit).toFixed(2)}\n` +
      `• **Stop Loss Invalidation:** $${parseFloat(proposal.stopLoss).toFixed(2)}\n\n` +
      `📝 **Justification:** ${proposal.reason}\n\n` +
      `⚡ **Awaiting Permission:** Reply with /approve to execute this trade on Bitget!`;

    await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(message));
  } catch (error: any) {
    ctx.reply(`❌ Failed to complete scan: ${error.message}`);
  }
});

bot.command('approve', async (ctx) => {
  const proposal = pendingProposals.get(ctx.chat.id);

  if (!proposal) {
    return ctx.reply("❌ Error: No pending trade proposal found. Run `/trade <coin>` first to scan.");
  }

  ctx.reply(`⚡ Permission granted. Initializing Asiwaju Agent Shield SDK pipeline on-server...`);

  try {
    const tradeRequest = {
      symbol: proposal.symbol,
      side: proposal.side as 'buy' | 'sell',
      price: parseFloat(proposal.price),
      quantity: parseFloat(proposal.quantity)
    };

    const shieldReport = await AsiwajuAgentShield.processSecureTrade(
      proposal.reason,
      tradeRequest,
      `telegram_sig_${Date.now()}`
    );

    let logsMessage = "🔒 *Asiwaju Agent Shield Security Report*\n\n";
    shieldReport.logs.forEach((logLine: string) => {
      logsMessage += `• ${logLine}\n`;
    });

    if (shieldReport.success) {
      logsMessage += `\n🎯 **Trade Executed Live!**\nOrder ID: \`${shieldReport.orderId}\``;
      pendingProposals.delete(ctx.chat.id);
    } else {
      logsMessage += `\n❌ **AAS Shield BLOCKED:** ${shieldReport.message}`;
    }

    await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(logsMessage));
  } catch (error: any) {
    ctx.reply(`❌ Handshake timeout or exception: ${error.message || 'Transaction rejected.'}`);
  }
});

bot.command('autopilot', async (ctx) => {
  const messageText = ctx.message?.text || '';
  const args = messageText.split(' ');
  const coin = args[1]?.trim();

  isAutopilotOn = !isAutopilotOn;

  if (isAutopilotOn) {
    ctx.reply(`🤖 [Autopilot] Mode ENGAGED. Commencing active market monitoring on ${coin ? coin.toUpperCase() : 'Core Portfolio Whitelist (BTC, SOL, ETH)'}...`);
    try {
      const result = await runAutopilotExecution(coin);
      const [status, symbol, side, price, details] = result.split(":");

      if (status === "EXECUTED") {
        const message = `🎯 **Autopilot Trade Executed Live!** 🎯\n\n` +
          `• **Asset:** ${symbol}\n` +
          `• **Direction:** ${side}\n` +
          `• **Price:** $${parseFloat(price).toFixed(2)}\n` +
          `• **Bitget Order ID:** \`${details}\` [4]`;
        await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(message));
      } else {
        ctx.reply(`🤖 [Autopilot] Scan complete. Safety outcome: ${result}`);
      }
    } catch (error: any) {
      console.error(error);
      ctx.reply("❌ Exception during autopilot execution loop.");
    }
  } else {
    ctx.reply("🤖 [Autopilot] Mode DISENGAGED. Reverting to manual approval.");
  }
});

// Launch Bot recursively to catch ETIMEDOUT handshakes and auto-recover
function launchTelegramBot() {
  bot.launch()
    .then(() => {
      console.log("🚀 Asiwaju AI Hub Unified Bot is active and listening on Telegram...");
    })
    .catch((err) => {
      console.error("⚠️ Telegram Bot failed to launch. Retrying in 5 seconds...", err.message);
      setTimeout(launchTelegramBot, 5000); // Recursive re-launch loop
    });
}
launchTelegramBot();

// Graceful termination
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));