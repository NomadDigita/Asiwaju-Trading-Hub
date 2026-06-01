export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { runNewsAudit } from "@/utils/sentinel";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const report = await runNewsAudit();
    return NextResponse.json({ report });
  } catch (error: any) {
    console.error("API Error in Sentinel Route:", error);
    return NextResponse.json({ error: error.message || "Failed to compile news audit." }, { status: 500 });
  }
}