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

export async function callUnifiedAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const qwenKey = process.env.QWEN_API_KEY;
  const muleKey = process.env.MULERUN_API_KEY;

  // Dynamically adjust timeout: 8 seconds for Vercel, 30 seconds for Render
  const TIMEOUT_LIMIT = process.env.VERCEL ? 8000 : 30000;

  // Standard User-Agent header to bypass cloud-datacenter firewall blocks
  const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
            { role: 'user', content: userPrompt }
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
            { role: 'user', content: userPrompt }
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

  // Compile and throw a highly detailed diagnostic report returned directly as the error!
  throw new Error(
    `🚨 [AI GATEWAY OUTAGE REPORT]\n\n` +
    `1️⃣ [MuleRun API Log]:\n${muleErrorLog}\n\n` +
    `2️⃣ [Alibaba Qwen API Log]:\n${qwenErrorLog}\n\n` +
    `👉 Please review these logs to locate the exact cause (such as 401 Unauthorized, 402 Insufficient Funds, or 404 Endpoint Not Found).`
  );
}