export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { scanMarketOpportunity, TradeProposal } from "@/utils/agent";
import { AsiwajuAgentShield } from "@/infra/ShieldSDK";
import { TradeRequest } from "@/infra/RiskGuardrail";

export async function GET(request: NextRequest): Promise<Response> {
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

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const proposal: TradeProposal = await request.json();
    if (!proposal || !proposal.symbol || !proposal.quantity) {
      return NextResponse.json({ error: "Invalid trade proposal payload." }, { status: 400 });
    }

    const tradeRequest: TradeRequest = {
      symbol: proposal.symbol,
      side: proposal.side,
      price: parseFloat(proposal.price),
      quantity: parseFloat(proposal.quantity)
    };

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