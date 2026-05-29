require('dotenv').config();

async function testMuleRun() {
  const apiKey = process.env.MULERUN_API_KEY;

  if (!apiKey || apiKey === 'waiting_for_telegram') {
    console.error("❌ Error: MULERUN_API_KEY is missing or unconfigured in .env");
    return;
  }

  try {
    const response = await fetch('https://api.mulerun.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash', // Standard high-speed model supported on MuleRun
        messages: [
          {
            role: 'user',
            content: 'Explain the concept of "Vibe Trading" in cryptocurrency in exactly two sentences.'
          }
        ],
        stream: false
      })
    });

    const data = await response.json();

    console.log("=================================");
    console.log("🛰️ MuleRun API Status:", response.status === 200 ? "SUCCESS! 🎉" : "FAILED ❌");
    console.log("💬 AI Response:");
    
    if (data.choices && data.choices[0]) {
      console.log(data.choices[0].message.content.trim());
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
    console.log("=================================");
  } catch (error) {
    console.error("❌ An error occurred during MuleRun handshake:", error);
  }
}

testMuleRun();