import { NextResponse } from "next/server";
import { runInvestmentCommittee } from "@/utils/committee";

export async function POST(request: Request) {
  try {
    const { coin } = await request.json();
    if (!coin) {
      return NextResponse.json({ error: "Coin ticker is required." }, { status: 400 });
    }
    
    // Execute our multi-agent debate
    const report = await runInvestmentCommittee(coin);
    return NextResponse.json({ report });
  } catch (error: any) {
    console.error("API Error in Committee Route:", error);
    return NextResponse.json({ error: error.message || "Failed to resolve committee." }, { status: 500 });
  }
}