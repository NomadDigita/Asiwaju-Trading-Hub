import dotenv from 'dotenv';
dotenv.config();

import { Telegraf } from 'telegraf';
import crypto from 'crypto';
import { runInvestmentCommittee } from './utils/committee';
import { runBehavioralAudit } from './utils/guardian';
import { generateStrategyAndBacktest } from './utils/lab';
import { runNewsAudit } from './utils/sentinel';

// Verify Bot Token
const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  throw new Error("❌ Error: TELEGRAM_BOT_TOKEN is missing in .env");
}

const bot = new Telegraf(botToken);

// Helper to escape raw HTML special characters
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Convert standard Markdown output to safe Telegram HTML
function convertMarkdownToTelegramHtml(markdown: string): string {
  const parts = markdown.split(/(\`\`\`[\s\S]*?\`\`\`)/g);

  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith('```')) {
      const code = parts[i]
        .replace(/^\`\`\`(python|javascript|typescript|json)?\n/, '')
        .replace(/\`\`\`$/, '');
      parts[i] = `<pre>${escapeHtml(code)}</pre>`;
    } else {
      let text = escapeHtml(parts[i]);
      
      // Convert headers (e.g. ##, ###) to bold
      text = text.replace(/^#+\s*(.*)$/gm, '<b>$1</b>');
      
      // Convert **bold** to <b>bold</b>
      text = text.replace(/\*\*(.*?)\*\"/g, '<b>$1</b>');
      text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      
      // Convert inline `code` to <code>code</code>
      text = text.replace(/\`(.*?)\`/g, '<code>$1</code>');
      
      parts[i] = text;
    }
  }

  return parts.join('');
}

// Automatically splits messages exceeding Telegram's 4096-character limit
async function sendSafeHtmlMessage(ctx: any, htmlText: string) {
  const CHAR_LIMIT = 3800; // Safe threshold under Telegram's 4096-char limit

  if (htmlText.length <= CHAR_LIMIT) {
    return ctx.reply(htmlText, { parse_mode: 'HTML' });
  }

  const lines = htmlText.split('\n');
  let currentChunk = "";
  let inPreBlock = false;

  for (const line of lines) {
    // Check if the current line opens or closes a code block
    if (line.includes('<pre>')) inPreBlock = true;
    if (line.includes('</pre>')) inPreBlock = false;

    // Evaluate length constraint (adding safety padding for closing tags)
    if (currentChunk.length + line.length + 20 > CHAR_LIMIT) {
      let sendText = currentChunk;
      if (inPreBlock) {
        sendText += '</pre>'; // Close open pre block for the first message
      }

      await ctx.reply(sendText, { parse_mode: 'HTML' });

      // Initialize the next chunk, carrying over the <pre> tag if split occurred inside code
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
    "👉 /strategy <PROMPT> - Compile and backtest a strategy (e.g., /strategy Buy when RSI < 30 on 1h, sell at 4% gain)\n" +
    "👉 /news - Check market sentiment and FUD/FOMO signals"
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
    ctx.reply("❌ Failed to resolve consensus. Check the AI gateway log.");
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
    ctx.reply("❌ Failed to generate portfolio audit. Check the AI gateway log.");
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
    ctx.reply("❌ Failed to compile strategy. Check the AI gateway log.");
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
    ctx.reply("❌ Failed to compile news audit. Check the AI gateway log.");
  }
});

// Launch Bot
bot.launch().then(() => {
  console.log("🚀 Asiwaju AI Hub Unified Bot is active and listening on Telegram...");
});

// Graceful termination
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));