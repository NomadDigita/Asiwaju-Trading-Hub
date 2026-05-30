import { NextResponse } from "next/server";
import { scanMarketOpportunity, executeApprovedTrade, TradeProposal } from "@/utils/agent";

// GET endpoint: Scans for active trade setups
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coin = searchParams.get("coin") || "SOL";

  try {
    const proposal = await scanMarketOpportunity(coin);
    if (!proposal) {
      return NextResponse.json({ message: "NO_SETUP" });
    }
    return NextResponse.json(proposal);
  } catch (error: any) {
    console.error("API Error in Agent Scan Route:", error);
    return NextResponse.json({ error: error.message || "Failed to scan market." }, { status: 500 });
  }
}

// POST endpoint: Executes the authorized trade proposal on Bitget
export async function POST(request: Request) {
  try {
    const proposal: TradeProposal = await request.json();
    if (!proposal || !proposal.symbol || !proposal.quantity) {
      return NextResponse.json({ error: "Invalid trade proposal payload." }, { status: 400 });
    }

    // Execute the live transaction
    const executionResult = await executeApprovedTrade(proposal);
    const [status, details] = executionResult.split(":");

    if (status === "SUCCESS") {
      return NextResponse.json({ success: true, orderId: details });
    } else {
      return NextResponse.json({ success: false, error: details }, { status: 400 });
    }
  } catch (error: any) {
    console.error("API Error in Agent Execution Route:", error);
    return NextResponse.json({ error: error.message || "Failed to execute transaction." }, { status: 500 });
  }
}