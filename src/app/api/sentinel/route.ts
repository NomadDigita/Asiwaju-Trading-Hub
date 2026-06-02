export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { callUnifiedAI } from "@/utils/ai";

const MOCK_NEWS_FEED = [
  { source: "Bloomberg", headline: "Fed hints at potential rate cuts in upcoming Q3 meeting as inflation cools.", category: "Macro" },
  { source: "Coindesk", headline: "Solana daily active wallets hit new record high amid meme coin volume surge.", category: "Crypto" },
  { source: "Reuters", headline: "Major US investment bank files for spot Solana ETF, citing high institutional demand.", category: "Regulation" }
];

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const systemPrompt = `You are the Chief Intelligence Officer and Sentinel News Analyst at Asiwaju AI Hub.
    Analyze the news feed.
    You MUST respond in this exact JSON format (and absolutely no other conversational wrapper or markdown syntax):
    {
      "index": 92,
      "rating": "Extreme FOMO, Extreme FUD, or Neutral",
      "macro": "Macro analysis summary in 2 sentences",
      "drivers": [
        { "event": "Event 1 Name", "desc": "Impact description in 1 sentence" },
        { "event": "Event 2 Name", "desc": "Impact description in 1 sentence" },
        { "event": "Event 3 Name", "desc": "Impact description in 1 sentence" }
      ],
      "tactical": "Tactical trading suggestions in 2 sentences"
    }`;

    const rawReport = await callUnifiedAI(systemPrompt, `Analyze this news feed: ${JSON.stringify(MOCK_NEWS_FEED, null, 2)}`);
    const parsed = JSON.parse(rawReport);
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("API Error in Sentinel Route:", error);
    return NextResponse.json({ error: error.message || "Failed to compile news audit." }, { status: 500 });
  }
}