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

  // Dynamically adjust timeout: 8 seconds for Vercel Serverless, 30 seconds for Render background workers
  const TIMEOUT_LIMIT = process.env.VERCEL ? 8000 : 30000;

  // 1. Primary Attempt: MuleRun Gateway (Verified Stable & Active)
  if (muleKey && muleKey !== 'waiting_for_telegram') {
    try {
      console.log(`🧠 [AI] Querying Primary Gateway: MuleRun (Timeout: ${TIMEOUT_LIMIT / 1000}s)...`);
      const response = await fetchWithTimeout('https://api.mulerun.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${muleKey}`
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

      if (response.status === 200) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      }
      console.warn(`⚠️ [AI] Primary MuleRun returned status: ${response.status}. Attempting secondary fallback.`);
    } catch (error: any) {
      console.warn(`⚠️ [AI] Primary MuleRun failed: ${error.message}. Attempting secondary fallback.`);
    }
  }

  // 2. Secondary Attempt: Alibaba Cloud DashScope (Qwen-Plus)
  if (qwenKey && qwenKey !== 'waiting_for_email') {
    try {
      console.log(`🧠 [AI] Querying Secondary Fallback: Alibaba Cloud Qwen-Plus (Timeout: ${TIMEOUT_LIMIT / 1000}s)...`);
      const response = await fetchWithTimeout('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qwenKey}`
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

      if (response.status === 200) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      }
      throw new Error(`Alibaba Qwen returned status: ${response.status}`);
    } catch (error: any) {
      console.warn(`⚠️ [AI] Secondary Qwen failed: ${error.message}.`);
    }
  }

  // If both fail, throw an explicit, clear exception describing the API credentials outage
  throw new Error(
    "❌ [AI Handshake Failed] Both MuleRun and Alibaba Qwen API keys failed to authenticate. " +
    "Verify your credit balances and confirm that your keys are active on your dashboards."
  );
}