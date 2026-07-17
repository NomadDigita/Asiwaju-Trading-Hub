# Asiwaju AI Hub & Agent Shield (AAS) SDK — Technical Audit Report

**Auditor:** Claude (automated audit)
**Date:** 2026-07-16
**Commit audited:** `53d3011` (HEAD of `main` at audit time)

## Follow-up Fix Log (post-audit)

- **[FIXED — SECURITY]** Removed the entire `src/app/api/*` Next.js route tree (`agent`, `audit`, `autopilot`, `committee`, `sentinel`, `strategy`). This resolves the architecture-duplication finding, but on closer inspection it's more than cleanup: these routes, deployed live on Vercel alongside the frontend, had **no authentication of any kind** — independent of the `ASIWAJU_API_KEY` gate just added to `src/index.ts`. `POST /api/agent` in particular called `AsiwajuAgentShield.processSecureTrade` directly, meaning anyone who found the Vercel URL could attempt real trades (bounded only by the Shield's internal $10/whitelist/cooldown guardrails) with zero authentication, for as long as the app had live Bitget keys configured on Vercel. Confirmed via grep that `src/app/page.tsx` never calls any relative `/api/*` path — the dashboard exclusively talks to `BACKEND_API_BASE` (the Render server) — so these routes were fully dead code with no legitimate traffic, in addition to being unauthenticated and duplicating logic that had already drifted from `src/index.ts` (e.g. the mock data, `any`-typed error handling). They also structurally couldn't replace `src/index.ts` even if wired up, since Vercel serverless functions can't host the persistent Telegram/Discord bot connections, the `setInterval` autopilot loop, or the keep-alive self-ping. Deleted rather than patched. Verified `tsc --noEmit` and `next build` both pass clean afterward, with the build's route table now showing only `/` and `/_not-found` — no more `/api/*` entries in the frontend bundle.
- **[FIXED]** Recommendation #6 — "Add basic auth/API-key gating in front of the publicly-reachable Render REST endpoints." Added an optional shared-secret check (`ASIWAJU_API_KEY` env var, sent as an `X-API-Key` header) guarding every `/api/*` route in `src/index.ts`. Left optional for backward compatibility with existing deployments that haven't set it — but logs an explicit warning on every unauthenticated `/api/*` request so the gap is never silent. Wired the dashboard (`src/app/page.tsx`) to send the same header via a new `backendFetch` helper when `NEXT_PUBLIC_ASIWAJU_API_KEY` is set, and left the root `/` health-check path (used by the keep-alive self-ping) exempt from the gate.
  - Verified functionally: with `ASIWAJU_API_KEY` set, requests to `/api/sentinel` with no key or the wrong key return `401`; the correct key passes the gate (confirmed it reaches downstream logic, which then fails on missing AI-provider keys in the test environment — expected). The unauthenticated root path still returns `200`.
- **[FIXED]** Documentation/code mismatch — the "4 hours" autopilot interval claimed in `README.md` and in `src/index.ts`'s comments/log message did not match the actual `6 * 60 * 60 * 1000` (6-hour) value. All three references corrected to say 6 hours.
- **[FIXED]** Removed the dynamic `require('./ai')` inside `src/utils/agent.ts` (previously used to dodge a suspected circular import) in favor of a normal static `import` — confirmed there was no actual circular dependency between `agent.ts` and `ai.ts`. Also removes one `@typescript-eslint/no-require-imports` lint error.
- **[FIXED]** Two `@typescript-eslint/no-unused-vars` warnings (`catch (error)` with an unused binding in `guardian.ts` and `sentinel.ts`) — changed to parameter-less `catch {}` blocks.
- **[FIXED]** Recommendation #3 — "Make Telegram/Discord bot startup optional and resilient." `src/bot.ts` and `src/discord.ts` previously called `throw new Error(...)` at module-load time if `TELEGRAM_BOT_TOKEN` / `DISCORD_BOT_TOKEN` were missing. Because `src/index.ts` (the Render backend hosting the REST API the web dashboard depends on) imports `bot` and `client` at the top of the file, a missing bot token — unrelated to trading functionality — crashed the *entire* backend on boot, taking the REST API down with it.
  - Fix: both files now log a `console.warn` instead of throwing, skip `bot.launch()` / `client.login()` respectively when unconfigured, and let the rest of the process (REST API, keep-alive loop, autopilot loop) run normally.
  - Verified: ran `npx tsx src/index.ts` with a completely empty environment (`env -i`) — server now logs the warnings, binds to its port, and stays alive (`📡 Render API Server active on port 8080. Bots are operational.`), instead of exiting immediately as it did before.

## Audit Environment & Constraints

This audit was performed in a sandboxed environment with **outbound network access limited to package registries** (npm, PyPI, GitHub). The following external services used by this project were **not reachable** from the audit environment, and therefore could not be live-tested end-to-end:

- `api.bitget.com` (exchange balances/trading)
- `api.telegram.org` (Telegram bot)
- Discord gateway (`discord.js` client)
- `dashscope-intl.aliyuncs.com` (Qwen/DashScope)
- `api.mulerun.com` (MuleRun/Gemini fallback)
- `api.tavily.com` (news search)
- `api.binance.com`, `api.dexscreener.com`, `min-api.cryptocompare.com`, `hacker-news.firebaseio.com`

No real credentials (Bitget keys, Telegram/Discord bot tokens, Qwen/MuleRun/Tavily keys) were provided or available. Everything below that required those services was tested with **missing or dummy credentials** to observe error-handling behavior, not live functional outcomes. Where a real conclusion requires those credentials/network access, this is stated explicitly — that is the only honest way to report on this codebase from here.

---

## Phase 1 — Repository Analysis

**Stack:** Next.js 16.2.6 (App Router, Turbopack) + React 19.2 + TypeScript 5.9 + Tailwind CSS v4, deployed as two separate runtimes:
- **Frontend:** Next.js app (`src/app`) intended for Vercel, containing both the dashboard UI (`page.tsx`) *and* a parallel set of API routes (`src/app/api/*`).
- **Backend:** a standalone long-running Node process (`src/index.ts`, run via `tsx`) intended for Render, which hosts a raw `http` server exposing the same logical endpoints, plus a Telegraf Telegram bot and a discord.js Discord bot.

**Shared business logic** lives in `src/utils/*` (ai.ts, agent.ts, committee.ts, guardian.ts, lab.ts, sentinel.ts, bitget.ts) and `src/infra/*` (PromptFilter.ts, RiskGuardrail.ts, ShieldSDK.ts).

**External services / integrations claimed:**
- Bitget Spot v2 (balances, order history, market data, order placement) — HMAC-SHA256 signed requests.
- Alibaba Cloud DashScope (Qwen) — primary LLM.
- MuleRun (Gemini 2.5 Flash) — secondary/fallback LLM.
- Tavily Search — real-time news/price context.
- CryptoCompare, Binance, DEXScreener, HackerNews — public market/news fallbacks.
- Telegram (Telegraf) and Discord (discord.js) bots.

**Required env vars** (see README's own table, which is accurate on this point): `BITGET_API_KEY`, `BITGET_SECRET_KEY`, `BITGET_PASSPHRASE`, `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN`, `QWEN_API_KEY`, `MULERUN_API_KEY`, `TAVILY_API_KEY` (optional), `PORT`, `RENDER_EXTERNAL_URL`.

**Critical architectural finding (confirmed by code + runtime test):** `src/app/page.tsx` hardcodes `BACKEND_API_BASE = "https://asiwaju-trading-hub-wi3a.onrender.com"` and every dashboard action fetches that URL directly — **never** the Next.js API routes under `src/app/api/*` that ship in the same repo/deployment. This means the Vercel-deployed API routes are effectively dead code from the dashboard's perspective; they exist as an entirely separate, undocumented parallel implementation of the same endpoints, only reachable if someone calls them directly.

---

## Phase 2 — Build & Environment Verification

| Step | Result |
|---|---|
| `npm install` | ✅ Success, 413 packages, 0 vulnerabilities reported by npm, one deprecation notice (`node-domexception`, transitive via `node-fetch`) |
| `npx tsc --noEmit` (whole repo) | ✅ 0 errors |
| `next build` (Turbopack) | ✅ Compiled successfully, all 6 API routes + `/` registered correctly |
| `npx eslint .` | ⚠️ **100 errors, 16 warnings** (see Phase 6) |
| `tsx src/index.ts` with **no env vars** | ❌ Hard crash: `Error: TELEGRAM_BOT_TOKEN is missing in .env` at import time (`src/bot.ts:18`), before the HTTP server even binds |
| `tsx src/index.ts` with dummy `TELEGRAM_BOT_TOKEN`/`DISCORD_BOT_TOKEN` | ✅ HTTP server binds and serves; Telegram/Discord login fail gracefully in background (see Phase 4) |
| `next dev` | ✅ Boots, `/` returns HTTP 200 |

**Finding:** The backend (`src/index.ts`) cannot start **at all** — not even the REST API portion — unless both `TELEGRAM_BOT_TOKEN` and `DISCORD_BOT_TOKEN` are set to *some* non-empty string, because `bot.ts` and `discord.ts` throw at module-load time and `index.ts` imports them unconditionally at the top of the file. An operator who only wants the trading/API features (no bots) cannot run this service without dummy bot tokens as a workaround.

---

## Phase 3 — Feature Inventory

- **Frontend dashboard** (`page.tsx`): 6 tabs — War Room (committee), Guardian (audit), Strategy Lab, Sentinel (news), AI Agent (scan/execute/autopilot toggle), Shield SDK (static info panel).
- **Backend REST API** (`src/index.ts`, Render): `/api/committee`, `/api/audit`, `/api/strategy`, `/api/sentinel`, `/api/agent` (GET scan / POST execute), `/api/autopilot`.
- **Duplicate Vercel REST API** (`src/app/api/*/route.ts`): same 6 endpoints, unused by the shipped frontend (see Phase 1).
- **Telegram bot** (`src/bot.ts`): `/start`, `/balance`, `/research`, `/audit`, `/strategy`, `/news`, `/trade`, `/approve`, `/autopilot`, plus a reply-keyboard menu mirroring the same commands.
- **Discord bot** (`src/discord.ts`): `!balance`, `!research`, `!audit`, `!strategy`, `!news`, `!trade`, `!approve`, `!autopilot`.
- **Asiwaju Agent Shield (AAS) SDK** (`src/infra/*`): 5-layer pipeline — prompt-injection firewall (Qwen/MuleRun-backed), programmatic risk guardrails ($10 max size, symbol whitelist, 30s cooldown), in-memory re-entrancy lock, in-memory replay-signature cache, HMAC-signed Bitget order execution.
- **Background jobs** (`index.ts`, Render only): keep-alive self-ping every 10 min; autonomous portfolio scan every 6 hours (README/comment say "4 hours" — mismatch, see Phase 5).
- **Client-side state:** discipline-score history persisted in `localStorage` (`asiwaju_score_history`), used to give the Guardian coaching prompt some continuity — purely client-side, not synced to any backend store.
- **No authentication/authorization anywhere.** There is no user login, no session, no per-user identity. All Bitget/Telegram/Discord credentials are single, global, server-side secrets — this is a single-operator tool, not a multi-tenant SaaS.
- **No database.** All "history" is either in-memory (Node process variables, lost on restart/redeploy) or `localStorage` (lost per-browser).
- **Hardcoded Telegram recipient:** `index.ts` sends autopilot alerts to a hardcoded chat ID (`6582793388`) — not configurable via env var, so this alerting only ever works for whoever owns that specific Telegram account.

---

## Phase 4 — Functional Testing (with evidence)

| Feature | Status | Evidence |
|---|---|---|
| npm install / TS compile / Next.js build | ✅ Works | Phase 2 table above |
| Next.js dashboard renders (`/`) | ✅ Works | `curl` → `HTTP 200` |
| Next.js API route error handling (`/api/committee` with no AI keys) | ✅ Works as designed | Returned structured JSON: `{"error":"🚨 [AI GATEWAY OUTAGE REPORT]... No active Qwen Key Staged... MuleRun Key Not Configured..."}` |
| Render-style backend (`src/index.ts`) boot with missing bot tokens | ❌ Crashes | `Error: TELEGRAM_BOT_TOKEN is missing in .env` |
| Backend boot with dummy bot tokens | ⚠️ Partially works | HTTP server binds and serves API routes; Telegram bot enters an **infinite 5-second retry loop logging errors forever** (`launchTelegramBot` recursion, no backoff/cap); Discord client fails once and stops (no retry) |
| `/api/agent` GET (market scan) with no `QWEN_API_KEY` | ✅ Fails gracefully | `{"error":"Market scan failed: QWEN_API_KEY is missing from environment variables."}` — but only *after* it already made (blocked, in this sandbox) network calls to Bitget/Binance/DEXScreener for price and to Tavily/CryptoCompare for sentiment; in a real deployment with only `QWEN_API_KEY` unset, this wastes multiple outbound calls before failing |
| Trade execution via AAS SDK (`ShieldSDK.processSecureTrade`) | 🚧 Blocked by a real bug | See "Critical Bugs" below — Layer 1 hard-requires `MULERUN_API_KEY` specifically, even if only `QWEN_API_KEY` is configured |
| Bitget balance/order history/order placement | ⛔ Not verifiable here | Requires real Bitget credentials + network egress to `api.bitget.com`, neither available in this sandbox. Code review shows correct HMAC-SHA256 signing pattern per Bitget v2 spec, but this is not the same as confirming a live 200 response. |
| Telegram bot commands | ⛔ Not verifiable here | Requires a real bot token + Telegram network access |
| Discord bot commands | ⛔ Not verifiable here | Requires a real bot token + Discord gateway access |
| Autopilot 6-hour loop / 10-min keep-alive ping | ⛔ Not verifiable in a short-lived audit | Logic reviewed only; timers are correct in code (`6 * 60 * 60 * 1000`, `10 * 60 * 1000`) |
| "Zero-Trust" re-entrancy/replay guards | ⚠️ Partially sound | Logic is correct for a **single long-running process** (Render), but see Phase 6 for why it's unsound on serverless (Vercel) |

---

## Phase 5 — README vs. Reality

| Claim in README | Reality |
|---|---|
| "Autonomous Portfolio Scanner Loop... every 4 hours to minimize token consumption" | Code sets the interval to `6 * 60 * 60 * 1000` = **6 hours**, and the in-code comment even says "Triggered exactly every 4 hours (14,400,000 ms)" while `6*60*60*1000` = 21,600,000 ms. Comment, README, and code all disagree with each other (git history shows a commit "Change background scan interval to 6 hours" that updated the interval but not the surrounding comment/README text). |
| "AAS SDK... importable... developer utility" with a documented `processSecureTrade` example | The SDK is real and matches its documented signature, but its Layer 1 dependency on `MULERUN_API_KEY` (see bug below) means the documented example will fail for any integrator who only supplies `QWEN_API_KEY`, which the same README lists as the *primary* provider. |
| Directory layout diagram omits `src/app/api/*` entirely | The duplicate Vercel API route tree (5 files, real working code) isn't mentioned anywhere in the README, and isn't used by the shipped dashboard — likely leftover/parallel-track code that should either be wired up or removed. |
| No mention of `test-bitget.js`, `test-mulerun.js`, `test-telegram.js` | These are real, runnable, credential-dependent manual test scripts at the repo root; undocumented, and one (`test-telegram.js`) will call `bot.launch()` at import time exactly like `src/bot.ts`, i.e. it will crash without a token. |
| Env var table is otherwise accurate | ✅ Confirmed correct against actual `process.env.*` reads in code. |

---

## Phase 6 — Code Quality Audit

### Critical Bugs

1. **[Critical] AAS Shield Layer 1 is wrongly coupled to `MULERUN_API_KEY`.** `src/infra/PromptFilter.ts` does:
   ```ts
   const apiKey = process.env.MULERUN_API_KEY;
   if (!apiKey) throw new Error("MULERUN_API_KEY is missing from environment variables.");
   ```
   ...then never actually uses `apiKey` — it delegates to `callUnifiedAI`, which tries Qwen first and MuleRun only as fallback. This means **every single trade is blocked** if `MULERUN_API_KEY` isn't set, regardless of whether `QWEN_API_KEY` (the documented primary provider) is present and working. This directly contradicts the "AI Gateway" design intent in `ai.ts` and silently defeats the entire trading pipeline for anyone who configured only the primary key. **Fix:** remove this check entirely (or check that *either* key exists), and let `callUnifiedAI`'s own failover/error path handle unavailability.

2. **[High] Backend cannot boot without dummy Telegram+Discord tokens.** `src/index.ts` imports `bot.ts`/`discord.ts` at the top level; both throw synchronously if their token env var is absent. An operator who wants only the trading REST API (no bots) cannot start the service at all without faking tokens. **Fix:** make bot initialization conditional/lazy, or catch/log-and-skip instead of throwing.

3. **[High] Infinite unthrottled retry loop for Telegram launch.** `launchTelegramBot()` in `src/bot.ts` recurses forever on failure with a flat 5s delay and no backoff, no max attempts, and no way to disable it. With an invalid/expired token this will spam logs indefinitely and continuously hit Telegram's API, which is also a good way to get rate-limited or IP-flagged. **Fix:** exponential backoff + max retry count + circuit breaker.

4. **[Medium] `sanitizeAndParseJson` is duplicated verbatim in 5 files** (`src/index.ts`, and all 4 of `src/app/api/{audit,sentinel,committee,strategy}/route.ts`). Any bug fix (e.g., the markdown-fence regex) has to be applied in 5 places; it's already inconsistent with the AI-agent's own `extractShieldJson` in `PromptFilter.ts`/`agent.ts`, which is the same function under a different name. **Fix:** extract to a single shared `src/utils/json.ts`.

5. **[Medium] Unused dependency: `node-fetch`.** Declared in `package.json`/`package-lock.json`, never imported anywhere in `src/`. Node 22 has native `fetch`. Dead weight in the dependency tree (and one of only two deprecation warnings on install traces back to it). **Fix:** remove.

6. **[Medium] Dead/duplicate API surface.** The entire `src/app/api/*` route tree duplicates `src/index.ts`'s logic and is unreachable from the shipped dashboard (Phase 1 finding). Either the frontend should call these routes directly (removing the separate Render backend and the hardcoded external URL), or the routes should be deleted to stop the drift between two copies of the same business logic.

7. **[Medium] In-memory security state doesn't survive process boundaries.** `RiskGuardrail.ts`'s `lastTradeTimestamp` and `ShieldSDK.ts`'s `isExecuting` / `PROCESSED_SIGNATURES` are plain module-level variables. This is fine on the single long-lived Render process, but the *same* `ShieldSDK.processSecureTrade` is also called from `src/app/api/agent/route.ts`, which — if ever actually wired up and deployed to Vercel — runs as ephemeral serverless functions with **no guaranteed shared memory between invocations**. The re-entrancy lock, cooldown timer, and replay-signature cache would silently stop working there, defeating 3 of the 5 "zero-trust" layers. This is worth calling out given the SDK's marketing claims of being "zero-trust" middleware.

8. **[Low] Hardcoded personal Telegram chat ID** (`6582793388`) for autopilot alerts in `index.ts` — should be an env var.

9. **[Low] React lint findings on the frontend:** `setState` called synchronously inside `useEffect` bodies in both `page.tsx` (score-history hydration) and `WelcomeCard.tsx` (boot sequencer) — flagged by the new `react-hooks/set-state-in-effect` rule; functionally works today but is a React anti-pattern that can cause extra render passes. Also one `useEffect` with a stale-closure risk on `marketPrices` (missing dependency, currently masked by using the functional/object-spread pattern, but fragile).

10. **[Low] Unescaped JSX entities** (apostrophes/quotes) in `page.tsx` — 3 ESLint `react/no-unescaped-entities` errors; purely cosmetic/lint-clean issue, not a runtime bug.

### General Code Smells (non-blocking)
- **~90 `@typescript-eslint/no-explicit-any` errors** across `src/index.ts`, `bot.ts`, `discord.ts`, `PromptFilter.ts`, `agent.ts`, `ai.ts`, `guardian.ts`, `sentinel.ts`, `ShieldSDK.ts` — mostly on error-catch blocks (`catch (error: any)`) and raw HTTP handler params. Not bugs by themselves, but they defeat the type-safety the rest of the project otherwise has (the app compiles clean under strict `tsc`).
- `require()`-style imports flagged in `test-bitget.js`, `test-mulerun.js`, `test-telegram.js`, and one dynamic `require('./ai')` inside `agent.ts` (used to dodge a circular import — a sign the module graph could be restructured).
- No automated tests of any kind (no `test` script in `package.json`, no test framework installed). The three `test-*.js` files at the repo root are manual, credential-requiring smoke scripts, not part of any CI.
- No rate limiting, no request validation/schema (e.g. no check that `coin` is a known symbol before it's interpolated into API paths in several routes), no CORS restriction beyond a blanket `Access-Control-Allow-Origin: *` on the Render server.

---

## Phase 7 — End-to-End Workflow Testing

There is no user registration/login/auth flow to test (this is a single-operator tool by design — confirmed, not a gap on its own).

| Workflow | Result |
|---|---|
| Load dashboard → click "Convene Committee" | Cannot be run end-to-end here: the button calls the **external** Render URL (`asiwaju-trading-hub-wi3a.onrender.com`), which is a live third-party deployment not under my control and not something I should be sending test traffic to on the repo owner's behalf. Verified instead via the equivalent local API route with the same underlying logic — see Phase 4. |
| Scan → Approve → Execute trade (Agent tab) | Same limitation — requires live Bitget credentials. Verified the code path locally: `scanMarketOpportunity` → `AsiwajuAgentShield.processSecureTrade` → currently **fails at Layer 1** due to Bug #1 above, unless both AI keys are set. |
| Autopilot toggle | Same limitation; verified `/api/autopilot` returns a clean JSON error when keys are missing, matching the frontend's expected shape. |
| Telegram `/trade` → `/approve` | Not testable without a real bot token; code path mirrors the web agent flow and shares the same Bug #1 exposure. |

---

## Phase 8 — Final Audit Summary

### Overall Project Health Score: **58 / 100**

Rationale: the code is clean, compiles under strict TypeScript with zero errors, has a coherent multi-layer security concept, and its build/deploy story works. But it loses significant points for: a real functional bug that can silently block 100% of trades (Bug #1), an entire duplicate/dead API surface never wired to the UI, a backend that can't boot without unrelated bot credentials, no tests, no auth model beyond "one operator, one set of global secrets," and security guarantees ("zero-trust" layers) that don't hold up outside the one specific deployment topology (long-lived Render process) the author actually runs.

### ✅ Working (verified)
- npm install, TypeScript compile, Next.js production build.
- Next.js dashboard renders and is interactive.
- All 6 Next.js API routes exist, are reachable, and fail gracefully (structured JSON errors) when upstream keys are absent.
- Backend HTTP server (`index.ts`) binds and serves once given *any* non-empty bot tokens.
- AAS SDK's Layer 2 (risk guardrails: size cap, whitelist, cooldown) — logic verified via its own self-test block (`RiskGuardrail.ts`'s `require.main === module` test), correctly flags an out-of-bounds trade.

### ⚠️ Partially Working
- Telegram/Discord bot startup: server survives bad tokens, but Telegram enters an unthrottled infinite retry loop; Discord fails silently once and doesn't retry at all — inconsistent failure modes between the two.
- Market-scan endpoint: correctly falls back through Bitget → Binance → DEXScreener → hardcoded defaults for price data (verified fallback chain executes), but this "resilience" is currently untested in a working end-to-end sense since price-fetch endpoints are moot if the AI call afterward fails.

### ❌ Broken / Not Verifiable As Working
- **Full trade execution pipeline**, as shipped, is broken for anyone who follows the README's implication that `QWEN_API_KEY` is sufficient — Bug #1 blocks it unless `MULERUN_API_KEY` is also set.
- **Live Bitget balance/order/execution, Telegram bot, Discord bot** — not independently verifiable in this environment (no credentials, no egress). This is a gap in *this audit*, not a confirmed defect, but it also means no one should treat these as "confirmed working" based on the README alone.

### False Claims Identified
- "4 hours" autopilot interval (README + code comment) vs. actual `6 * 60 * 60 * 1000` (6 hours) in code.
- Implicit claim that the shipped dashboard talks to the Next.js API routes documented as part of "this" app — it does not; it talks to a separate, external, already-deployed Render instance.

### Security Findings
- Prompt-injection firewall can be silently disabled/bypassed *by omission*: if `MULERUN_API_KEY` is unset, Layer 1 throws before even evaluating the prompt — which currently fails closed (trade blocked), so this is a safety bug, not an exploitable bypass. But it shows the security layer's availability is accidentally coupled to an unrelated fallback provider's key.
- Zero-trust guarantees (re-entrancy lock, replay-signature cache) are correct only under a single persistent Node process; would silently degrade under serverless/multi-instance deployment of the same code path (Vercel `api/agent` route).
- Global CORS `*` on the Render REST API, no request-origin restriction, no auth token on any endpoint — anyone who discovers the Render URL can call `/api/agent` POST and attempt to place trades (gated only by the AAS pipeline itself, which is good, but there's no additional API-key/auth layer in front of it).
- No committed secrets found in the repository (`.gitignore` correctly excludes `.env*`; no `.env` file, no obvious API-key-shaped strings, checked via pattern search).

### Technical Debt
- Duplicate business logic between `src/index.ts` and `src/app/api/*` (2x maintenance surface for the same 6 endpoints).
- Duplicate `sanitizeAndParseJson`/`extractShieldJson` implementations (5+ copies).
- No test suite; no CI configuration found in the repo.
- Heavy use of `any` throughout error-handling and HTTP-glue code, undermining otherwise-clean strict TypeScript.

### Recommendations (highest → lowest impact)
1. Fix Bug #1 (`PromptFilter.ts`'s dead `MULERUN_API_KEY` check) — this is the single highest-impact fix; it currently can silently disable the core trading feature.
2. Decide the actual architecture: either delete `src/app/api/*` (if the Render backend is canonical) or delete `src/index.ts`'s duplicate REST layer and point `page.tsx` at relative `/api/*` routes (if Next.js should be self-contained). Shipping both, permanently out of sync, is the biggest architectural liability in the repo.
3. Make Telegram/Discord bot startup optional and resilient (bounded retries, no startup crash on missing token) so the trading API can run standalone.
4. Extract shared JSON-sanitizing/extraction logic into one utility module.
5. Add an automated test suite (even lightweight unit tests for `RiskGuardrail`, `PromptFilter`, and the JSON sanitizer) and wire up CI.
6. Add basic auth/API-key gating in front of the publicly-reachable Render REST endpoints, independent of the AAS SDK's internal checks.
7. Remove `node-fetch` and fix the ESLint findings (particularly the two `react-hooks/set-state-in-effect` issues and the unescaped-entity errors, both trivial).

### Deployment Readiness: **Development Only**

Justification: the project builds and runs, and its security *concept* is sound, but a confirmed functional bug can block its primary feature under a documented-as-supported configuration, its two API implementations have drifted apart with the shipped UI only exercising one of them (which lives outside this repo's own deployment), there's no automated test coverage, and none of the live third-party integrations (Bitget, Telegram, Discord, Qwen, MuleRun, Tavily) could be independently confirmed working in this audit due to missing credentials/network access. This is a promising prototype/personal-project state, not yet Beta- or Production-ready.

---

## What Would Be Needed to Complete Verification
To move this audit from "code-verified" to "fully functionally verified," the following would be required, none of which were available here:
- Real Bitget API key/secret/passphrase (sandbox/testnet or live, small-balance account) and outbound network access to `api.bitget.com`.
- Real Telegram bot token + outbound access to `api.telegram.org`.
- Real Discord bot token + outbound access to Discord's gateway.
- Real Qwen (DashScope) and/or MuleRun API keys + outbound access to their endpoints.
- (Optional) Tavily API key for the news-search enrichment path.
- Access to (or permission to load-test) the actual deployed Render instance at `asiwaju-trading-hub-wi3a.onrender.com`, since that is what the shipped dashboard actually talks to.
