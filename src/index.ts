import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import https from 'https';

// Import our self-executing bot controllers
import './bot';
import './discord';

const PORT = process.env.PORT || 8080;
// Render automatically injects its public domain under RENDER_EXTERNAL_URL
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || "https://asiwaju-trading-hub.onrender.com";

// Create dummy HTTP server to satisfy Render's port-binding checks
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Asiwaju AI Companion Bots are active and listening.\n');
});

server.listen(PORT, () => {
  console.log(`📡 Render Port-Binding established on port ${PORT}. Bots are operational.`);

  // Self-Ping Loop: Executes an internal request every 10 minutes to prevent free-tier sleeping
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
});