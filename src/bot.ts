// LINE 1: Force ES6 variables configuration
import 'dotenv/config';

import { Telegraf } from 'telegraf';
import crypto from 'crypto';
import { runInvestmentCommittee } from './utils/committee';
import { runBehavioralAudit } from './utils/guardian';
import { generateStrategyAndBacktest } from './utils/lab';
import { runNewsAudit } from './utils/sentinel';
import { scanMarketOpportunity, executeApprovedTrade, runAutopilotExecution, TradeProposal } from './utils/agent';

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

// 1. Start Command
bot.start((ctx) => {
  ctx.reply(
    "🦅 Welcome to Asiwaju AI Hub Command Center!\n\n" +
    "Use these commands to interact with our features:\n" +
    "👉 /balance - Check your live Bitget Spot wallet\n" +
    "👉 /research <COIN> - Convene the AI Investment Committee (e.g., /research SOL)\n" +
    "👉 /audit - Run the Anti-Liquidator Behavioral Risk Audit\n" +
    "👉 /strategy <PROMPT> - Compile and backtest a strategy\n" +
    "👉 /news - Check market sentiment and FUD/FOMO signals\n" +
    "👉 /trade <COIN> - Prompt the AI Agent to scan market setups\n" +
    "👉 /autopilot - Toggle the Autonomous Autopilot Trader ON/OFF"
  );
});

// 2. Bitget Spot Balance Command
bot.command('balance', async (ctx) => {
  ctx.reply("🛰️ Interrogating Bitget V2 API, please wait...");

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
        return ctx.reply("💰 Your Spot wallet is currently empty.");
      }

      let message = "📊 *Asiwaju Spot Portfolio Summary*\n\n";
      activeBalances.forEach((asset: any) => {
        const available = parseFloat(asset.available).toFixed(4);
        message += `• *${asset.coin}*: ${available}\n`;
      });

      await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(message));
    } else {
      ctx.reply(`❌ Exchange Error: ${result.msg || 'Handshake failed'}`);
    }
  } catch (error) {
    console.error(error);
    ctx.reply("❌ Connection timeout. Check local proxy or network tunnel status.");
  }
});

// 3. Multi-Agent AI Investment Committee Command
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
  } catch (error) {
    console.error(error);
    ctx.reply(`❌ Error: ${(error as any).message || 'Failed to generate committee report.'}`);
  }
});

// 4. Behavioral Risk Audit Command (Anti-Liquidator)
bot.command('audit', async (ctx) => {
  ctx.reply("🛡️ Fetching spot trade history and generating behavioral risk audit...");

  try {
    const report = await runBehavioralAudit();
    await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(report));
  } catch (error) {
    console.error(error);
    ctx.reply(`❌ Error: ${(error as any).message || 'Failed to generate behavioral risk audit.'}`);
  }
});

// 5. Strategy Lab Compiler Command
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
  } catch (error) {
    console.error(error);
    ctx.reply(`❌ Error: ${(error as any).message || 'Failed to compile strategy.'}`);
  }
});

// 6. Sentinel News Sentiment Command
bot.command('news', async (ctx) => {
  ctx.reply("📡 Querying global macro headlines and generating market intelligence...");

  try {
    const report = await runNewsAudit();
    await sendSafeHtmlMessage(ctx, convertMarkdownToTelegramHtml(report));
  } catch (error) {
    console.error(error);
    ctx.reply(`❌ Error: ${(error as any).message || 'Failed to compile sentinel news audit.'}`);
  }
});

// 7. Autonomous Agent Trading Scan Command
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

    // Save the proposal in user chat memory
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
  } catch (error) {
    console.error(error);
    ctx.reply("❌ Failed to complete scan. Check the agentic gateway logs.");
  }
});

// 8. Autonomous Agent Trading Execution Command
bot.command('approve', async (ctx) => {
  const proposal = pendingProposals.get(ctx.chat.id);

  if (!proposal) {
    return ctx.reply("❌ Error: No pending trade proposal found. Run `/trade <coin>` first to scan.");
  }

  ctx.reply(`⚡ Permission granted. Broadcasting signed market order to Bitget Spot V2...`);

  try {
    const executionResult = await executeApprovedTrade(proposal);
    const [status, details] = executionResult.split(":");

    if (status === "SUCCESS") {
      ctx.reply(`🎯 **Trade Executed Live!** 🎯\n\nOrder ID: \`${details}\``, { parse_mode: 'Markdown' });
      pendingProposals.delete(ctx.chat.id); // Clear proposal memory on success
    } else {
      ctx.reply(`❌ Order placement failed: ${details}`);
    }
  } catch (error) {
    console.error(error);
    ctx.reply("❌ Handshake timeout. Transaction rejected.");
  }
});

// 9. Autonomous Autopilot Trading Toggle Command
bot.command('autopilot', async (ctx) => {
  const messageText = ctx.message?.text || '';
  const args = messageText.split(' ');
  const coin = args[1]?.trim(); // Optional coin parameter

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
        ctx.reply(`🤖 [Autopilot] Scan complete. Safety abort status: ${result}`);
      }
    } catch (error) {
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