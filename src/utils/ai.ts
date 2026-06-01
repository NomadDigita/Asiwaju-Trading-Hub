import dotenv from 'dotenv';
dotenv.config();

export async function callUnifiedAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const qwenKey = process.env.QWEN_API_KEY;
  const muleKey = process.env.MULERUN_API_KEY;

  // 1. Primary Attempt: MuleRun Gateway (Gemini-2.5-Flash)
  if (muleKey && muleKey !== 'waiting_for_telegram') {
    try {
      console.log("🧠 [AI] Querying Primary Gateway: MuleRun (Gemini-2.5-Flash)...");
      const response = await fetch('https://api.mulerun.com/v1/chat/completions', {
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
      console.warn(`⚠️ [AI] Primary MuleRun failed: ${error.message}. Attempting secondary fallback.`);
    }
  }

  // 2. Secondary Fallback: Alibaba Cloud DashScope (Qwen-Plus)
  if (qwenKey && qwenKey !== 'waiting_for_email') {
    try {
      console.log("🧠 [AI] Querying Secondary Fallback: Alibaba Cloud Qwen-Plus...");
      const response = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
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
      console.error(`⚠️ [AI] Secondary Qwen failed: ${error.message}`);
    }
  }

  throw new Error("❌ [AI Handshake Failed] Both MuleRun and Alibaba Qwen APIs returned authentication errors. Check your active token balances.");
}