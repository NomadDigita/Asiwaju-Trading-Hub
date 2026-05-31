# Asiwaju AI Hub & Agent Shield (AAS) SDK

Welcome to **Asiwaju AI Hub**, an immersive, 3D glassmorphic Web Dashboard and dual-bot interface (Telegram & Discord) designed to bridge retail traders with high-end quantitative backtesting, behavioral auditing, and autonomous AI trading agent executions.

This repository represents a dual-track submission:
1. **Asiwaju AI Hub (Track 3: Open Track):** The multi-platform user interface (Next.js, Telegraf, Discord.js) [4].
2. **Asiwaju Agent Shield (Track 2: AI Infrastructure):** An open-source, Zero-Trust Guardrail and Observability SDK that wraps any AI trading agent's execution loop to prevent prompt injections, risk violations, and wallet-draining anomalies [4].

---

## 🔗 Production Links

* **Live Web Dashboard:** [asiwaju-trading-hub.vercel.app](https://asiwaju-trading-hub.vercel.app)
* **Telegram Command Bot:** [@AsiwajuTradingBot](https://t.me/AsiwajuTradingBot)
* **Discord Companion Bot:** [Invite Link](https://discord.com/oauth2/authorize?client_id=1509519700751810740&permissions=3072&scope=bot)
* **Backend Bot Server:** [asiwaju-trading-hub.onrender.com](https://asiwaju-trading-hub.onrender.com)

---

## 🏛️ System Modules (The 4-in-1 Command Center)

### 1. 🏛️ The War Room (Investment Committee)
An advanced multi-agent orchestrator. When prompted, it launches three specialized AI analysts in parallel using **Alibaba Qwen** via **MuleRun**:
* **Technical Analyst:** Assesses indicator momentum, structures, and moving averages.
* **Risk Manager:** Skeptically identifies downside traps, resistance levels, and liquidation leverage pools.
* **On-Chain Analyst:** Synthesizes institutional ETF inflows and whale accumulation metrics.
* **The Chairman (Consensus Agent):** Resolves contradictions and generates a unified, structured PDF-ready analysis report with a clear action trigger.

### 2. 🛡️ The Guardian (Anti-Liquidator)
A psychological risk auditor. It connects to the user's read-only exchange history via **Bitget Spot V2 APIs** and uses an LLM behavioral coach to audit trading logs for psychological traps (FOMO, revenge trading, panic selling, or loss aversion), outputting a Behavioral Health Score (0-100) and actionable coaching adjustments.

### 3. 🧪 The Strategy Lab (Quantitative Compiler)
A natural language strategy builder. Users input strategies in plain English (e.g., *"Buy SOL when RSI under 30, sell at 4% gain"*). The compiler translates the parameters, generates a clean, syntax-highlighted Python Pandas backtesting script, and runs a simulated 30-day performance report. On the Web Dashboard, this performance is visualized via an animated, glowing **SVG Neon Equity Curve Chart**.

### 4. 📡 The Sentinel (News Terminal)
A macro sentiment scanner. It aggregates global crypto announcements and news indexes, uses an AI evaluator to compute a **Market Hype Index (0-100)**, categorizes the market sentiment (e.g. Extreme FOMO vs Extreme FUD), and delivers tactical advisory summaries.

### 5. 🤖 Autonomous Trading Agent
A natural-language market execution console. Users command the agent (via Web UI, `/trade`, or `!trade`) to scan live charts for breakout opportunities.
* **Autopilot Mode:** If enabled, the agent scans a whitelist of core assets (`['BTC', 'SOL', 'ETH']`) sequentially. If a high-confidence setup is found ($\ge$ 8/10), it bypasses manual authorization and executes the trade autonomously [4].

---

## 🛡️ Asiwaju Agent Shield (AAS) SDK (Track 2: AI Infrastructure)

To run our trading agent safely in production, we built the **Asiwaju Agent Shield (AAS)**—an open-source, zero-trust developer middleware SDK located in `/src/infra/` [4]. 

### The Security Pipeline:
1. **Layer 1: Prompt Security (`PromptFilter.ts`):** Evaluates incoming raw text commands using Qwen to block prompt-injection, override instructions, credential leak attempts, or asset-draining anomalies.
2. **Layer 2: Programmatic Risk (`RiskGuardrail.ts`):** Enforces hardcoded, developer-defined constraints that the AI cannot override (e.g., maximum trade size capped at $10, restricting trades to a high-liquidity symbol whitelist, and enforcing a mandatory 30-second cooldown delay).
3. **Layer 3: Secure Signer & Executor (`ShieldSDK.ts`):** Once layers 1 & 2 pass, the SDK securely signs the transaction using encrypted server environment variables, keeping private API keys isolated from the agent's LLM environment [4].

### SDK Integration Example:
Other developers can easily secure their trading agents by importing the AAS SDK:

```typescript
import { AsiwajuAgentShield } from './infra/ShieldSDK';
import { TradeRequest } from './infra/RiskGuardrail';

const userPrompt = "Buy $5 of SOL at market price.";
const tradeRequest: TradeRequest = {
  symbol: "SOLUSDT",
  side: "buy",
  price: 172.50,
  quantity: 0.028
};

// Execute trade through the multi-layer security shield
const report = await AsiwajuAgentShield.processSecureTrade(userPrompt, tradeRequest);

if (report.success) {
  console.log(`🎯 Trade executed successfully. Order ID: ${report.orderId}`);
} else {
  console.warn(`🔴 Trade blocked: ${report.message}`);
}
```

---

## 🛠️ Local Development & Installation

### Prerequisites:
* **Node.js** v18+ installed on your machine.
* A registered **Bitget account** with API keys generated (Spot Read/Write enabled) [4].
* **Cloudflare WARP** active (if developing in regions with crypto network throttles).

### 1. Clone the repository:
```bash
git clone https://github.com/NomadDigita/Asiwaju-Trading-Hub.git
cd Asiwaju-Trading-Hub
```

### 2. Install dependencies:
```bash
npm install
```

### 3. Setup Environment Variables (`.env`):
Create a `.env` file in the root directory and populate it with your keys:
```env
BITGET_API_KEY=your_bitget_api_key
BITGET_SECRET_KEY=your_bitget_secret_key
BITGET_PASSPHRASE=your_bitget_passphrase

TELEGRAM_BOT_TOKEN=your_telegram_bot_token
DISCORD_BOT_TOKEN=your_discord_bot_token

MULERUN_API_KEY=your_mulerun_api_key
QWEN_API_KEY=your_qwen_api_key
```

### 4. Run the local servers:
```bash
# Force IPv4 DNS ordering to prevent WARP/Windows network timeouts
$env:NODE_OPTIONS="--dns-result-order=ipv4first"

# Start the Web Dashboard
npm run dev

# Start the Unified Bot Server (Telegram & Discord)
npx tsx src/index.ts
```

---

## 📦 Deployment Guides

### Frontend (Vercel):
1. Import your GitHub repository to **Vercel**.
2. Set Framework Preset to **Next.js**.
3. Configure your Environment Variables (`BITGET_API_KEY`, `MULERUN_API_KEY`, etc.) inside the Vercel dashboard.
4. Click **Deploy**.

### Backend Bots (Render):
1. Create a new **Web Service** on **Render** connected to your GitHub repository.
2. Set Runtime to **Node**, Build Command to `npm install`, and Start Command to `npx tsx src/index.ts`.
3. Load your environment variables (including `TELEGRAM_BOT_TOKEN` and `DISCORD_BOT_TOKEN`) into the Render dashboard.
4. Click **Deploy**. Our pre-configured orchestrator will open an HTTP port and run a self-pinging keep-alive loop to prevent the free-tier service from sleeping [4].