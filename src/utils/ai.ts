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

  // 1. Primary Attempt: MuleRun Gateway (Verified Stable & Active)
  if (muleKey && muleKey !== 'waiting_for_telegram') {
    try {
      console.log("🧠 [AI] Querying Primary Gateway: MuleRun (Gemini-2.5-Flash)...");
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
      });

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
      console.warn(`⚠️ [AI] Primary MuleRun failed or timed out: ${error.message}. Attempting secondary fallback.`);
    }
  }

  // 2. Secondary Fallback: Alibaba Cloud DashScope International (Qwen-Plus)
  if (qwenKey && qwenKey !== 'waiting_for_email') {
    try {
      console.log("🧠 [AI] Querying Secondary Fallback: Alibaba Cloud DashScope (Qwen-Plus)...");
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
      });

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
      console.error("❌ [AI] Both AI Gateways failed to resolve:", error.message);
      throw error;
    }
  }

  throw new Error("❌ AI Configuration Error: Both QWEN_API_KEY and MULERUN_API_KEY are missing.");
}