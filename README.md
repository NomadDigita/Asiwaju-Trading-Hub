# 🦅 ASIWAJU AI HUB & AGENT SHIELD (AAS) SDK

## 🏛️ Project Overview

The **Asiwaju AI Hub** is an integrated Web3 execution terminal and companion bot ecosystem designed to democratize quantitative analysis, behavioral risk auditing, and automated algorithmic spot trading on the **Bitget Spot V2** exchange.

To secure AI-driven financial execution, the workspace implements the **Asiwaju Agent Shield (AAS) SDK**, a zero-trust programmatic security layer that intercepts LLM trade signals. The SDK evaluates prompts and transaction parameters against an immutable, code-level risk boundary matrix, completely separating volatile AI brains from your private cryptographic keys.

---

## 🛡️ The Zero-Trust Security Paradigm (AAS SDK)

AI Agents are highly vulnerable to prompt injections, malicious smart contract re-entrancy callbacks, and signature replay attacks. The AAS SDK implements a **5-layer defensive pipeline** executed entirely server-side, keeping credentials isolated from the LLM context:

```text
[Browser Dashboard / Bot Command]
               │
               ▼
   [Layer 1: Prompt Filter]      ──► Runs Qwen prompt injection check on-server
               │
               ▼
   [Layer 2: Risk Guardrails]    ──► Programmatic cap check ($10 size, whitelists, cooldowns)
               │
               ▼
   [Layer 3: Re-entrancy Guard]  ──► Stateful thread-lock checks
               │
               ▼
   [Layer 4: Replay Guard]       ──► In-memory cryptographic signature nonce check
               │
               ▼
   [Layer 5: HMAC-SHA256 Sign]   ──► Generates sign headers on-server, dispatches order to Bitget
```

---

## 🧪 Core Ecosystem Features

1. **🏛️ The War Room (AI Investment Committee):** A multi-agent consensus debate engine. Three parallel specialized analysts (Technical, Risk, and On-Chain) debate market setups, while the Chairman Agent resolves the final trading verdict.
2. **🛡️ The Guardian (Psychological Auditor):** Interrogates private Bitget Spot order logs. If the log is empty, it queries public exchange trade fills. It analyzes transactions for psychological biases (FOMO, Revenge Trading, Panic Selling) and calculates a Behavioral Health Score (0-100), tracking progress via a client-side memory ledger.
3. **🧪 The Strategy Lab (NL Strategy Compiler):** Translates plain English strategies into syntactically valid Python Pandas backtesting scripts, rendering performance returns on a dynamic, glowing **SVG Neon Equity Curve**.
4. **📡 The Sentinel (Hype Index Terminal):** Scrapes live, real-time news headlines using CryptoCompare APIs (with fallback Tavily dynamic search loops) to calculate a dynamic Market Hype Index.
5. **🤖 AI Execution Agent & Autopilot Console:** Scans markets using the **Market Regime Detection Engine** to dynamically shift trading style (Range-bound mean reversion vs. Momentum breakout). Orders are secured via the AAS SDK.
   * **Autopilot Mode:** A 24/7 persistent worker that scans core whitelist assets (`['BTC', 'SOL', 'ETH']`) every 10 minutes, dispatches direct orders, and broadcasts alert notifications to your Telegram and Discord channels.

---

## 📂 Directory Structure

```text
asiwaju-ai-hub/
├── .env                              # Active environment variables (git-ignored)
├── .gitignore                        # Git ignore patterns for keys and build bundles
├── package.json                      # Dependency manifests & compilation scripts
├── tsconfig.json                     # TypeScript compiler configurations
├── src/
│   ├── index.ts                      # Render Server Entry - Unified API & Bot Orchestrator
│   ├── bot.ts                        # Telegram Bot Controller
│   ├── discord.ts                    # Discord Bot Companion
│   ├── app/
│   │   ├── globals.css               # Tailwind v4 imports, liquidglass theme styles
│   │   ├── layout.tsx                # HTML root layout shell, animated backdrop blurs
│   │   └── page.tsx                  # Main Web Dashboard, interactive tabs, SVG chart
│   ├── components/
│   │   ├── Navbar.tsx                # Fixed-floating header, custom TG/DC SVGs
│   │   └── WelcomeCard.tsx           # Mac-style welcome terminal, custom brand SVG
│   ├── infra/
│   │   ├── PromptFilter.ts           # Layer 1: AI Prompt Injection Firewall
│   │   ├── RiskGuardrail.ts          # Layer 2: Programmatic Risk Boundaries
│   │   └── ShieldSDK.ts              # Layer 3/4: Stateful Re-entrancy & Signing SDK
│   └── utils/
│       ├── agent.ts                  # Market price scanners, price aggregators & Bitget order placers
│       ├── ai.ts                     # Unified HA AI completions gateway with Tavily
│       ├── bitget.ts                 # Secure HMAC header signature generator
│       ├── committee.ts              # Multi-agent debate & proof of reasoning engine
│       ├── guardian.ts               # Behavioral risk auditor and Bitget history puller
│       ├── lab.ts                    # Strategy translator and backtest simulator
│       └── sentinel.ts               # Live news scraper and Hype Index engine
```

---

## 📡 API Routing Specifications

### REST API Server Routes (Render Backend / Port 10000)

| Route Path | Method | Payload Input | Response Output |
| :--- | :--- | :--- | :--- |
| `/api/committee` | `POST` | `{ "coin": "SOL" }` | JSON consensus scorecard |
| `/api/audit` | `POST` | `{ "scoreHistory": [25, 32] }` | JSON behavioral evaluation |
| `/api/strategy` | `POST` | `{ "prompt": "Buy RSI < 30" }` | JSON translated code & backtest |
| `/api/sentinel` | `POST` | `{}` | JSON hype index and news drivers |
| `/api/agent` | `GET` | `?coin=SOL` | JSON pending trade proposal |
| `/api/agent` | `POST` | `TradeProposal` | JSON AAS SDK execution result |
| `/api/autopilot` | `POST` | `{ "coin": "SOL" }` | JSON autopilot loop status |

---

## 🛠️ Installation & Local Development Setup

### Prerequisites
*   Node.js v18.0.0 or higher
*   NPM v9.0.0 or higher
*   Git

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/asiwaju-trading-hub.git
cd asiwaju-trading-hub
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables (`.env`)
Create a `.env` file in the root directory and populate your keys:
```env
# Exchange Authentication Keys (Bitget Spot V2)
BITGET_API_KEY=your_bitget_api_key_here
BITGET_SECRET_KEY=your_bitget_secret_key_here
BITGET_PASSPHRASE=your_bitget_passphrase_here

# Bot Tokens
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
DISCORD_BOT_TOKEN=your_discord_bot_token_here

# High-Availability AI Gateways
QWEN_API_KEY=your_alibaba_dashscope_api_key_here
MULERUN_API_KEY=your_mulerun_api_key_here
TAVILY_API_KEY=your_tavily_search_api_key_here

# Server Settings
PORT=8080
RENDER_EXTERNAL_URL=https://asiwaju-trading-hub.onrender.com
```

### 4. Run the Dev Server Locally
To launch both the REST API Server and the Telegram/Discord bot controllers concurrently:
```bash
npx tsx src/index.ts
```

To run the Next.js frontend locally:
```bash
npm run dev
```

---

## 🚀 Deployment Instructions

The workspace utilizes a decoupled dual-platform topology:

### 1. Frontend Client Dashboard (Vercel Serverless)
*   **Build Command:** `next build`
*   **Build Environment:** Set `NEXT_PUBLIC_BACKEND_API_BASE` pointing to your deployed Render URL.

### 2. Backend API Server & Bot Thread (Render Persistent Container)
*   **Build Command:** `npm install`
*   **Start Command:** `npx tsx src/index.ts`
*   **Settings:** Ensure Port binding is set to `10000`. Disable auto-sleeping.

---

## 🛡️ Troubleshooting & Diagnostics

*   **`409 Conflict` (Telegram Bot Crashes):** This means you have another local terminal running the bot concurrently. Shut down all local terminals using `Ctrl + C` before deploying.
*   **Price Overwrites (Fixed):** The 10-second live poller is now completely decoupled from the scanned proposals. Real-time prices for BTC, ETH, SOL, BNB, and BGB are rendered in a dedicated live market card.
*   **Geoblocking Restrictions:** Centralized exchange requests originating from US-based cloud servers will hang. The platform contains custom geoblocking fallbacks that dynamically route through Binance/DEXScreener/CoinGecko public APIs.
```
```