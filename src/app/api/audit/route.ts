export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { callUnifiedAI } from "@/utils/ai";

const MOCK_EMOTIONAL_LOG = [
  { timestamp: "1780000000000", symbol: "SOLUSDT", side: "buy", price: "188.50", size: "15", notes: "Bought at local peak after a massive green hourly candle (FOMO)" },
  { timestamp: "1780003600000", symbol: "SOLUSDT", side: "sell", price: "171.20", size: "15", notes: "Panic sold at a major loss during a temporary drop" },
  { timestamp: "1780005400000", symbol: "SOLUSDT", side: "buy", price: "179.00", size: "30", notes: "Immediately re-entered with double the position size to claw back losses (Revenge trading)" },
  { timestamp: "1780009000000", symbol: "SOLUSDT", side: "sell", price: "165.00", size: "30", notes: "Panic sold again at a larger loss as market continued down" }
];

function sanitizeAndParseJson(rawText: string): any {
  let cleanText = rawText
    .replace(/^\`\`\`(json)?\n/, '')
    .replace(/\`\`\`$/, '')
    .trim();

  const startIdx = cleanText.indexOf('{');
  const endIdx = cleanText.lastIndexOf('}');

  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`JSON Boundaries Missing. Raw: ${rawText.slice(0, 100)}`);
  }

  const jsonString = cleanText.slice(startIdx, endIdx + 1);
  return JSON.parse(jsonString);
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const systemPrompt = `You are the Lead Risk Auditor and Behavioral Trading Coach at Asiwaju AI Hub.
    Analyze the user's trading log.
    You MUST respond in this exact JSON format (and absolutely no other conversational wrapper or markdown syntax):
    {
      "score": 25,
      "evaluation": "Sincere behavioral evaluation in 2 sentences",
      "biases": ["FOMO", "Revenge Trading", "Panic Selling"],
      "criticalMistake": "Describe the worst transaction mistake in 1 sentence",
      "adjustments": [
        { "title": "Planning", "desc": "Pre-trade adjustments description" },
        { "title": "Cool-Off", "desc": "Mandatory cool-off rule description" },
        { "title": "Sizing", "desc": "Fixed sizing rule description" }
      ]
    }`;

    const rawReport = await callUnifiedAI(systemPrompt, `Analyze this trade log: ${JSON.stringify(MOCK_EMOTIONAL_LOG, null, 2)}`);
    const parsed = sanitizeAndParseJson(rawReport);
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("API Error in Audit Route:", error);
    return NextResponse.json({ error: error.message || "Failed to compile audit." }, { status: 500 });
  }
}