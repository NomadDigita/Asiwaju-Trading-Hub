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

  // Standard, industry-grade User-Agent header to bypass cloud-datacenter firewall blocks
  const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  // 1. Primary Attempt: MuleRun Gateway (Gemini-2.5-Flash)
  if (muleKey && muleKey !== 'waiting_for_telegram') {
    try {
      console.log("🧠 [AI] Querying Primary Gateway: MuleRun (Gemini-2.5-Flash)...");
      const response = await fetchWithTimeout('https://api.mulerun.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${muleKey}`,
          'User-Agent': USER_AGENT // Bypasses Cloudflare empty User-Agent blocks
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
        if (content) {
          console.log("🧠 [AI] Primary MuleRun Response Resolved.");
          return content;
        }
      }
      console.warn(`⚠️ [AI] Primary MuleRun returned status: ${response.status}. Attempting secondary fallback.`);
    } catch (error: any) {
      console.warn(`⚠️ [AI] Primary MuleRun failed: ${error.message}. Attempting secondary fallback.`);
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
          'User-Agent': USER_AGENT // Bypasses Cloudflare empty User-Agent blocks
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
        if (content) {
          console.log("🧠 [AI] Secondary Qwen Response Resolved.");
          return content;
        }
      }
      throw new Error(`Alibaba Qwen returned status: ${response.status}`);
    } catch (error: any) {
      console.error(`❌ [AI] Secondary Qwen failed: ${error.message}`);
    }
  }

  throw new Error(
    "❌ [AI Handshake Failed] Both MuleRun and Alibaba Qwen APIs returned authentication or connection errors. " +
    "Verify your credit balances and confirm that your keys are active on your dashboards."
  );
}