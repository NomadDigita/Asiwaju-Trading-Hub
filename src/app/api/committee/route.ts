export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { callUnifiedAI } from "@/utils/ai";

// Robust JSON Sanitizer to prevent markdown code block syntax crashes
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
    const { coin } = await request.json();
    if (!coin) {
      return NextResponse.json({ error: "Coin ticker is required." }, { status: 400 });
    }

    const systemPrompt = `You are the Chairman of the Asiwaju AI Investment Committee.
    Analyze the coin: ${coin.toUpperCase()}.
    You MUST respond in this exact JSON format (and absolutely no other conversational wrapper or markdown syntax):
    {
      "rating": "BUY, SELL, or HOLD",
      "score": "X/10",
      "trigger": "One clear price level or signal to wait for",
      "tech": "Focused technical analyst view in 2 sentences",
      "risk": "Risk manager warning in 2 sentences",
      "chain": "On-chain activity view in 2 sentences",
      "debate": "Consensus debate synthesis in 3 sentences",
      "reasoning": "Step-by-step proof of reasoning logs in 4 lines"
    }`;

    const rawReport = await callUnifiedAI(systemPrompt, `Run consensus audit for ${coin.toUpperCase()}`);
    const parsed = sanitizeAndParseJson(rawReport);
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("API Error in Committee Route:", error);
    return NextResponse.json({ error: error.message || "Failed to resolve committee." }, { status: 500 });
  }
}