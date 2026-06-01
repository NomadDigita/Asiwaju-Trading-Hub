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

  // 1. Primary Attempt: MuleRun Gateway (Gemini-2.5-Flash)
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
      console.log("🧠 [AI] Querying Secondary Fallback: Alibaba Cloud Qwen-Plus...");
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
      console.warn(`⚠️ [AI] Secondary Qwen failed: ${response.status}. Attempting absolute fallback.`);
    } catch (error: any) {
      console.warn(`⚠️ [AI] Secondary Qwen failed: ${error.message}. Attempting absolute fallback.`);
    }
  }

  // 3. Absolute Fallback: Free, Public, Non-Key-Blocked AI Completions (Llama-3) via Pollinations AI
  // This executes standard, 100% live, real-time AI generations on your data with zero key requirements!
  try {
    console.log("🧠 [AI] Querying Absolute Fallback: Pollinations AI (Llama-3)...");
    const response = await fetchWithTimeout('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        private: true // Safeguards transaction details
      })
    }, TIMEOUT_LIMIT);

    if (response.status === 200) {
      const content = await response.text();
      if (content && content.trim().length > 0) {
        console.log("🧠 [AI] Absolute Fallback Response Resolved.");
        return content.trim();
      }
    }
    throw new Error(`Pollinations AI returned status: ${response.status}`);
  } catch (error: any) {
    console.error("❌ [AI] All AI Gateways (including absolute fallbacks) failed:", error.message);
    throw error;
  }
}