require('dotenv').config();
const crypto = require('crypto');

async function testBitget() {
  const apiKey = process.env.BITGET_API_KEY;
  const secretKey = process.env.BITGET_SECRET_KEY;
  const passphrase = process.env.BITGET_PASSPHRASE;

  const timestamp = Date.now().toString();
  const method = 'GET';
  const requestPath = '/api/v2/spot/account/assets'; // Path to check your spot assets
  const body = ''; // Empty for GET requests

  // Create the encrypted handshake signature Bitget expects
  const preHash = timestamp + method + requestPath + body;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(preHash)
    .digest('base64');

  try {
    const response = await fetch('https://api.bitget.com' + requestPath, {
      method: 'GET',
      headers: {
        'ACCESS-KEY': apiKey,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-PASSPHRASE': passphrase,
        'locale': 'en-US',
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log("=================================");
    console.log("🛰️ Connection Status:", response.status === 200 ? "SUCCESS! 🎉" : "FAILED ❌");
    console.log("💬 Bitget Server Response:");
    console.log(JSON.stringify(data, null, 2));
    console.log("=================================");
  } catch (error) {
    console.error("An error occurred during handshake:", error);
  }
}

testBitget();