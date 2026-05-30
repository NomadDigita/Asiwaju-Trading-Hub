import dotenv from 'dotenv';
dotenv.config();

import { evaluatePromptSafety } from './PromptFilter';
import { evaluateRiskGuardrails, TradeRequest } from './RiskGuardrail';
import { executeApprovedTrade, TradeProposal } from '../utils/agent';

export interface ExecutionReport {
  success: boolean;
  promptSafety: 'SAFE' | 'UNSAFE';
  riskGuardrail: 'PASSED' | 'BLOCKED';
  message: string;
  orderId?: string;
}

export class AsiwajuAgentShield {
  /**
   * Orchestrates the complete defensive pipeline: Prompt Safety -> Risk Guardrails -> Secure Execution
   * @param prompt The natural language user command or agent intent
   * @param tradeRequest The parsed structured trade parameters
   */
  public static async processSecureTrade(
    prompt: string,
    tradeRequest: TradeRequest
  ): Promise<ExecutionReport> {
    console.log(`🔒 [ShieldSDK] Intercepting transaction request for ${tradeRequest.symbol}...`);

    // Layer 1: Prompt Safety Evaluation (AI Defense)
    try {
      const safetyReport = await evaluatePromptSafety(prompt);
      if (safetyReport.status === 'UNSAFE') {
        console.warn(`🔴 [ShieldSDK] Layer 1 Violation: Malicious or anomalous prompt detected. Blocking transaction.`);
        return {
          success: false,
          promptSafety: 'UNSAFE',
          riskGuardrail: 'BLOCKED',
          message: `Blocked by AI Security Filter: ${safetyReport.reason}`
        };
      }
      console.log(`🟢 [ShieldSDK] Layer 1 Passed: Prompt analyzed as SAFE.`);
    } catch (error: any) {
      console.error(`⚠️ [ShieldSDK] Layer 1 Exception: ${error.message}. Auto-blocking for defense.`);
      return {
        success: false,
        promptSafety: 'UNSAFE',
        riskGuardrail: 'BLOCKED',
        message: 'Security filter handshake failed. Auto-blocked.'
      };
    }

    // Layer 2: Programmatic Risk Evaluation (Code-Level Defense)
    const guardrailReport = evaluateRiskGuardrails(tradeRequest);
    if (!guardrailReport.passed) {
      console.warn(`🔴 [ShieldSDK] Layer 2 Violation: Programmatic risk bounds exceeded. Blocking transaction.`);
      return {
        success: false,
        promptSafety: 'SAFE',
        riskGuardrail: 'BLOCKED',
        message: `Blocked by Code Guardrails: ${guardrailReport.violations.join('; ')}`
      };
    }
    console.log(`🟢 [ShieldSDK] Layer 2 Passed: Transaction conforms to risk boundaries.`);

    // Layer 3: Secure Signing & Execution on Bitget
    console.log(`🛰️ [ShieldSDK] Layer 3: Handshake verified. Broadcasting order to Bitget Spot V2...`);
    try {
      // Map TradeRequest to TradeProposal format expected by the execution engine
      const proposal: TradeProposal = {
        symbol: tradeRequest.symbol,
        side: tradeRequest.side,
        price: tradeRequest.price.toString(),
        quantity: tradeRequest.quantity.toString(),
        stopLoss: (tradeRequest.side === 'buy' ? tradeRequest.price * 0.975 : tradeRequest.price * 1.025).toString(),
        takeProfit: (tradeRequest.side === 'buy' ? tradeRequest.price * 1.05 : tradeRequest.price * 0.95).toString(),
        reason: 'Authorized via Asiwaju Agent Shield SDK middleware.'
      };

      const executionResult = await executeApprovedTrade(proposal);
      const [status, details] = executionResult.split(':');

      if (status === 'SUCCESS') {
        return {
          success: true,
          promptSafety: 'SAFE',
          riskGuardrail: 'PASSED',
          message: 'Transaction successfully executed on Bitget Spot V2.',
          orderId: details
        };
      } else {
        return {
          success: false,
          promptSafety: 'SAFE',
          riskGuardrail: 'PASSED',
          message: `Exchange rejection: ${details}`
        };
      }
    } catch (error: any) {
      console.error(`❌ [ShieldSDK] Layer 3 Exception: ${error.message}`);
      return {
        success: false,
        promptSafety: 'SAFE',
        riskGuardrail: 'PASSED',
        message: `Execution pipeline exception: ${error.message}`
      };
    }
  }
}

// Self-executing CLI test block
if (require.main === module) {
  // We will run a complete test with a SAFE, conforming trade request
  const testPrompt = "Buy $5 of SOL at market price.";
  const testRequest: TradeRequest = {
    symbol: "SOLUSDT",
    side: "buy",
    price: 172.50,
    quantity: 0.028 // Total value = $4.83 (Conforms to our $10 limit)
  };

  console.log("🔒 Running Asiwaju Agent Shield Comprehensive SDK Handshake...");
  
  AsiwajuAgentShield.processSecureTrade(testPrompt, testRequest)
    .then((report) => {
      console.log("\n=================================");
      console.log("🛰️ SDK Defense Pipeline Execution Complete.");
      console.log(`🛡️ Overall Success: ${report.success ? '🟢 SUCCESS' : '🔴 BLOCKED'}`);
      console.log(`🔒 AI Security: ${report.promptSafety}`);
      console.log(`🛡️ Risk Guardrails: ${report.riskGuardrail}`);
      console.log(`💬 Status Message: ${report.message}`);
      if (report.orderId) {
        console.log(`🎯 Bitget Order ID: ${report.orderId}`);
      }
      console.log("=================================\n");
    })
    .catch((err) => console.error(err));
}