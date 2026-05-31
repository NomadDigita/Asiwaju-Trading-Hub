import { NextRequest, NextResponse } from "next/server";
import { runBehavioralAudit } from "@/utils/guardian";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Calls the live guardian utility which executes a real-time AI analysis via MuleRun
    const report = await runBehavioralAudit();
    return NextResponse.json({ report });
  } catch (error: any) {
    console.error("API Error in Audit Route:", error);
    return NextResponse.json({ error: error.message || "Failed to compile audit." }, { status: 500 });
  }
}