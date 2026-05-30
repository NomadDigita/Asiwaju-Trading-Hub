import dotenv from 'dotenv';
dotenv.config();

import http from 'http';

// Import our self-executing bot controllers
import './bot';
import './discord';

// Read the port Render assigns automatically
const PORT = process.env.PORT || 8080;

// Create dummy HTTP server to satisfy Render's port-binding checks
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Asiwaju AI Companion Bots are active and listening.\n');
});

server.listen(PORT, () => {
  console.log(`📡 Render Port-Binding established on port ${PORT}. Bots are operational.`);
});