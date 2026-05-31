import { NextRequest, NextResponse } from "next/server";
import { generateStrategyAndBacktest } from "@/utils/lab";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { prompt } = await request.json();
    if (!prompt) {
      return NextResponse.json({ error: "Strategy prompt is required." }, { status: 400 });
    }

    const report = await generateStrategyAndBacktest(prompt);
    return NextResponse.json({ report });
  } catch (error: any) {
    console.error("API Error in Strategy Route:", error);
    return NextResponse.json({ error: error.message || "Failed to compile strategy." }, { status: 500 });
  }
}