require('dotenv').config();
const { Telegraf } = require('telegraf');
const crypto = require('crypto');

// Initialize Telegram Bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Helper function to generate Bitget headers securely
function getBitgetHeaders(method, requestPath, body = '') {
  const apiKey = process.env.BITGET_API_KEY;
  const secretKey = process.env.BITGET_SECRET_KEY;
  const passphrase = process.env.BITGET_PASSPHRASE;

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
    "🦅 Welcome to Asiwaju Trading Hub!\n\n" +
    "Use these commands to interact with your portfolio:\n" +
    "👉 /balance - Check your live Bitget Spot balance"
  );
});

// 2. Balance Command
bot.command('balance', async (ctx) => {
  ctx.reply("🛰️ Fetching live balances from Bitget, please wait...");

  const requestPath = '/api/v2/spot/account/assets';
  const headers = getBitgetHeaders('GET', requestPath);

  try {
    const response = await fetch('https://api.bitget.com' + requestPath, {
      method: 'GET',
      headers: headers
    });

    const result = await response.json();

    if (result.code === '00000' && Array.isArray(result.data)) {
      // Filter out coins with virtually 0 balance for cleaner reading
      const activeBalances = result.data.filter(asset => parseFloat(asset.available) > 0);

      if (activeBalances.length === 0) {
        return ctx.reply("💰 Your Spot wallet is currently empty.");
      }

      let message = "📊 *Live Spot Balance Summary* 📊\n\n";
      activeBalances.forEach((asset) => {
        const available = parseFloat(asset.available).toFixed(4);
        message += `• *${asset.coin}*: ${available}\n`;
      });

      ctx.replyWithMarkdownV2(message.replace(/\./g, '\\.')); // Escape decimals for MarkdownV2 formatting
    } else {
      ctx.reply(`❌ Error from Bitget: ${result.msg || 'Unknown failure'}`);
    }
  } catch (error) {
    console.error(error);
    ctx.reply("❌ Network timeout or error connecting to Bitget.");
  }
});

// Launch Bot
bot.launch().then(() => {
  console.log("🚀 Asiwaju Telegram Bot is live and listening on Telegram...");
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));