import dotenv from 'dotenv';
dotenv.config();

// Standard compile-safe timeout wrapper compatible with Vercel serverless nodes
async function fetchWithTimeout(url: string, options: any, timeoutMs = 6000): Promise<Response> {
  const fetchPromise = fetch(url, options);
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Handshake timeout limit exceeded.")), timeoutMs)
  );
  return Promise.race([fetchPromise, timeoutPromise]) as Promise<Response>;
}

// Helper: Performs a sub-minute real-time web search for target token news using Tavily
async function getSubMinuteCryptoNews(query: string): Promise<string> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) return "";

  try {
    console.log(`📡 [Search] Executing sub-minute real-time web search for: "${query}"...`);
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: `${query} crypto news price latest`,
        search_depth: "basic",
        include_answers: false,
        max_results: 3
      })
    });

    if (response.status === 200) {
      const data = await response.json();
      if (Array.isArray(data.results)) {
        return data.results.map((r: any) => `• [${r.title}]: ${r.content}`).join('\n');
      }
    }
    return "";
  } catch (e: any) {
    console.warn("⚠️ Tavily Search API failed to resolve:", e.message);
    return "";
  }
}

export async function callUnifiedAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const qwenKey = process.env.QWEN_API_KEY;
  const muleKey = process.env.MULERUN_API_KEY;

  const TIMEOUT_LIMIT = process.env.VERCEL ? 8000 : 30000;
  const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  let enrichedUserPrompt = userPrompt;

  // Extract any uppercase word of 3-5 letters (the asset ticker) from the prompt
  const tickerMatch = userPrompt.match(/\b([A-Z]{3,5})\b/);
  const coin = tickerMatch ? tickerMatch[1] : null;

  if (coin && coin !== "USDT" && coin !== "RSI" && coin !== "MACD") {
    // Dynamically trigger sub-minute web search for the target asset
    const freshNews = await getSubMinuteCryptoNews(coin);
    if (freshNews) {
      enrichedUserPrompt = `${userPrompt}\n\n[SUB-MINUTE REAL-TIME WEB SEARCH RESULTS FOR ${coin}]:\n${freshNews}`;
    }
  }

  let muleErrorLog = "MuleRun Key Not Configured in Environment Panel.";
  let qwenErrorLog = "Qwen Key Not Configured in Environment Panel.";

  // 1. Primary Attempt: MuleRun Gateway (Gemini-2.5-Flash)
  if (muleKey && muleKey !== 'waiting_for_telegram') {
    try {
      console.log("🧠 [AI] Querying Primary Gateway: MuleRun (Gemini-2.5-Flash)...");
      const response = await fetchWithTimeout('https://api.mulerun.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${muleKey}`,
          'User-Agent': USER_AGENT
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: enrichedUserPrompt }
          ],
          stream: false
        })
      }, TIMEOUT_LIMIT);

      const responseText = await response.text();

      if (response.status === 200) {
        try {
          const data = JSON.parse(responseText);
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content) return content;
        } catch (e) {
          muleErrorLog = `[Status 200] JSON Parse Error. Raw: ${responseText.slice(0, 150)}`;
        }
      } else {
        muleErrorLog = `[Status Code ${response.status}] - Server Response: ${responseText.trim().slice(0, 200)}`;
      }
    } catch (error: any) {
      muleErrorLog = `[Network/Socket Exception] - ${error.message || 'Timeout'}`;
    }
  }

  // 2. Secondary Fallback: Alibaba Cloud DashScope (Qwen-Plus)
  if (qwenKey && qwenKey !== 'waiting_for_email') {
    try {
      console.log("🧠 [AI] Querying Secondary Fallback: Alibaba Cloud Qwen-Plus...");
      const response = await fetchWithTimeout('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qwenKey}`,
          'User-Agent': USER_AGENT
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: enrichedUserPrompt }
          ],
          stream: false
        })
      }, TIMEOUT_LIMIT);

      const responseText = await response.text();

      if (response.status === 200) {
        try {
          const data = JSON.parse(responseText);
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content) return content;
        } catch (e) {
          qwenErrorLog = `[Status 200] JSON Parse Error. Raw: ${responseText.slice(0, 150)}`;
        }
      } else {
        qwenErrorLog = `[Status Code ${response.status}] - Server Response: ${responseText.trim().slice(0, 200)}`;
      }
    } catch (error: any) {
      qwenErrorLog = `[Network/Socket Exception] - ${error.message || 'Timeout'}`;
    }
  }

  throw new Error(
    `🚨 [AI GATEWAY OUTAGE REPORT]\n\n` +
    `1️⃣ [MuleRun API Log]:\n${muleErrorLog}\n\n` +
    `2️⃣ [Alibaba Qwen API Log]:\n${qwenErrorLog}\n\n` +
    `👉 Please review these logs to locate the exact cause.`
  );
}