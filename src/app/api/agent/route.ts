import { NextResponse } from "next/server";
import { scanMarketOpportunity, TradeProposal } from "@/utils/agent";
import { AsiwajuAgentShield } from "@/infra/ShieldSDK";
import { TradeRequest } from "@/infra/RiskGuardrail";

// GET: Scans for active trade setups via Qwen/MuleRun
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

// POST: Runs the trade proposal through our Shield SDK before executing on Bitget
export async function POST(request: Request) {
  try {
    const proposal: TradeProposal = await request.json();
    if (!proposal || !proposal.symbol || !proposal.quantity) {
      return NextResponse.json({ error: "Invalid trade proposal payload." }, { status: 400 });
    }

    // Map proposal to the structured TradeRequest expected by the Shield SDK
    const tradeRequest: TradeRequest = {
      symbol: proposal.symbol,
      side: proposal.side,
      price: parseFloat(proposal.price),
      quantity: parseFloat(proposal.quantity)
    };

    // Execute the complete defensive pipeline using our custom SDK
    const shieldReport = await AsiwajuAgentShield.processSecureTrade(
      `Execute approved trade proposal for ${proposal.symbol} at market price.`, 
      tradeRequest
    );

    return NextResponse.json({
      success: shieldReport.success,
      promptSafety: shieldReport.promptSafety,
      riskGuardrail: shieldReport.riskGuardrail,
      message: shieldReport.message,
      orderId: shieldReport.orderId
    });

  } catch (error: any) {
    console.error("API Error in Agent Execution Route:", error);
    return NextResponse.json({ error: error.message || "Failed to execute transaction." }, { status: 500 });
  }
}