import { NextResponse } from "next/server";
import { runAutopilotExecution } from "@/utils/agent";

export async function POST(request: Request) {
  try {
    const { coin } = await request.json();
    if (!coin) {
      return NextResponse.json({ error: "Coin ticker is required for autopilot execution." }, { status: 400 });
    }

    console.log(`🤖 [API] Triggering Autopilot Execution loop for ${coin}...`);
    
    // Execute the autonomous trading agent loop
    const result = await runAutopilotExecution(coin);
    const [status, symbol, side, price, details] = result.split(":");

    if (status === "EXECUTED") {
      return NextResponse.json({
        success: true,
        status: "EXECUTED",
        message: `Autopilot ordered a market ${side} of ${symbol} at $${parseFloat(price).toFixed(2)} [4].`,
        orderId: details
      });
    } else {
      return NextResponse.json({
        success: false,
        status: "ABORTED",
        message: result // Returns the safety abort reason (e.g., "NO_SETUP" or "BLOCKED")
      });
    }
  } catch (error: any) {
    console.error("API Error in Autopilot Route:", error);
    return NextResponse.json({ error: error.message || "Failed to execute autopilot." }, { status: 500 });
  }
}