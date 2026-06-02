export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { callUnifiedAI } from "@/utils/ai";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { prompt } = await request.json();
    if (!prompt) {
      return NextResponse.json({ error: "Strategy prompt is required." }, { status: 400 });
    }

    const systemPrompt = `You are the Chief Quantitative Strategist and Code Compiler at Asiwaju AI Hub.
    Translate the user's plain English strategy into Python code.
    You MUST respond in this exact JSON format (and absolutely no other conversational wrapper or markdown syntax):
    {
      "translation": "Sincere strategy parameters translation in 2 sentences",
      "code": "import pandas as pd\\n# Fully working Python backtesting code here",
      "winRate": "50.0%",
      "trades": "12",
      "pnl": "+12.4%",
      "drawdown": "-3.2%",
      "factor": "1.8",
      "verdict": "Risk analyst verdict in 2 sentences"
    }`;

    const rawReport = await callUnifiedAI(systemPrompt, `Compile and simulate: ${prompt}`);
    const parsed = JSON.parse(rawReport);
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("API Error in Strategy Route:", error);
    return NextResponse.json({ error: error.message || "Failed to compile strategy." }, { status: 500 });
  }
}