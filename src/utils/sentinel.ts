import dotenv from 'dotenv';
dotenv.config();

interface NewsHeadline {
  source: string;
  headline: string;
  category: string;
}

// Simulated real-time macro & crypto news feed
const CURRENT_NEWS_FEED: NewsHeadline[] = [
  { source: "Bloomberg", headline: "Fed hints at potential rate cuts in upcoming Q3 meeting as inflation cools.", category: "Macro" },
  { source: "Coindesk", headline: "Solana daily active wallets hit new record high amid meme coin volume surge.", category: "Crypto" },
  { source: "Reuters", headline: "Major US investment bank files for spot Solana ETF, citing high institutional demand.", category: "Regulation" },
  { source: "CryptoQuant", headline: "Stablecoin exchange inflows reach 12-month peak, indicating massive sideline capital waiting to buy.", category: "On-Chain" },
  { source: "Financial Times", headline: "Global liquidity index expands; risk assets poised for structural capital inflows.", category: "Macro" }
];

export async function runNewsAudit(): Promise<string> {
  const apiKey = process.env.MULERUN_API_KEY;
  if (!apiKey) throw new Error("MULERUN_API_KEY is missing from environment variables.");

  const sentinelPrompt = `You are the Chief Intelligence Officer and Sentinel News Analyst at Asiwaju AI Hub. 
  Your objective is to analyze a feed of real-time crypto news, macro headlines, and regulatory events. 
  You must synthesize their overall psychological impact on retail and institutional traders, compute a Market Hype Index, 
  and write a highly structured sentiment digest.
  
  Determine the Fear/Hype Index on a scale of 0-100:
  - 0 to 30: Extreme FUD (Panic Selling, Capitulation)
  - 31 to 60: Neutral / Ranging
  - 61 to 100: Extreme FOMO (Retail Hype, Bubble Territory)
  
  You MUST output in this exact markdown format:
  
  ## 📡 Asiwaju Sentinel Market Intelligence
  *🚨 Current Sentiment & News Digest*
  
  ### 📊 Market Hype Index: [X/100] ([Category - e.g. Extreme FOMO, Neutral, or Extreme FUD])
  [Provide a sharp, 2-sentence macro analysis explaining why the index is at this level]
  
  ### 📰 Major Sentiment Drivers:
  * **[Headline 1 Name]:** [1-sentence impact analysis on asset prices]
  * **[Headline 2 Name]:** [1-sentence impact analysis on asset prices]
  * **[Headline 3 Name]:** [1-sentence impact analysis on asset prices]
  
  ### 💡 Tactical Trade Suggestion:
  [Provide 2 sentences of tactical, practical risk-adjusted positioning advice based on this intelligence digest]`;

  try {
    const response = await fetch('https://api.mulerun.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: sentinelPrompt },
          { role: 'user', content: `Analyze this news feed: ${JSON.stringify(CURRENT_NEWS_FEED, null, 2)}` }
        ],
        stream: false
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "Failed to generate market intelligence.";
  } catch (error) {
    console.error("Error in Sentinel analysis loop:", error);
    throw error;
  }
}

// Self-executing CLI test block
if (require.main === module) {
  runNewsAudit()
    .then((report) => {
      console.log("\n=================================");
      console.log(report);
      console.log("=================================\n");
    })
    .catch((err) => console.error(err));
}