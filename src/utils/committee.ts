import dotenv from 'dotenv';
dotenv.config();

import { callUnifiedAI } from './ai';

interface AnalystResponse {
  role: string;
  report: string;
}

async function askAnalyst(role: string, systemPrompt: string, coin: string): Promise<AnalystResponse> {
  const userPrompt = `Analyze the current market landscape for ${coin.toUpperCase()}.`;
  const report = await callUnifiedAI(systemPrompt, userPrompt);
  return { role, report };
}

export async function runInvestmentCommittee(coin: string): Promise<string> {
  const coinUpper = coin.toUpperCase();
  console.log(`🎬 Convening the Investment Committee for ${coinUpper}...`);

  const techPrompt = `You are the Lead Technical Analyst for Asiwaju AI Hub. 
  Your job is to look at price momentum, moving averages, relative strength (RSI), and chart structure. 
  Provide a highly focused, bullish-leaning technical perspective. Limit to 3-4 bullet points.`;

  const riskPrompt = `You are the Head Risk Manager for Asiwaju AI Hub. 
  Your job is to identify danger signs. Act as the ultimate skeptic. Point out local resistances, potential bearish divergences, 
  liquidations, or external macro risks. Be objective and cautious. Limit to 3-4 bullet points.`;

  const chainPrompt = `You are the Lead On-Chain & Institutional Analyst for Asiwaju AI Hub. 
  Your job is to analyze on-chain transaction metrics, whale wallets movement, exchange inflows/outflows, and protocol activity. 
  Limit to 3-4 bullet points.`;

  try {
    const [techResult, riskResult, chainResult] = await Promise.all([
      askAnalyst("Technical Analyst", techPrompt, coinUpper),
      askAnalyst("Risk Manager", riskPrompt, coinUpper),
      askAnalyst("On-Chain Analyst", chainPrompt, coinUpper)
    ]);

    console.log(`📊 Reports received. Convening the Chairman to resolve consensus & output Proof of Reasoning...`);

    const chairmanPrompt = `You are the Chairman of the Asiwaju AI Investment Committee. 
    You will be provided with three specialized analysis reports (Technical, Risk, and On-Chain) for ${coinUpper}.
    Your objective is to weigh all three arguments, resolve any contradictions, and output a highly structured decision.
    
    You MUST output in this exact markdown format:
    
    ## 🏦 Asiwaju Investment Committee Report: [COIN]
    
    ### 🕵️‍♂️ Analyst Perspectives:
    * **Technical View:** [Summarize tech analyst in 2 sentences]
    * **Risk Manager Warning:** [Summarize risk manager warning in 2 sentences]
    * **On-Chain Signal:** [Summarize on-chain analyst in 2 sentences]
    
    ### 🧠 Proof of Reasoning:
    1. **Deconstructing Inputs:** [Detail how you isolated the key themes of the analyst reports in 1 sentence]
    2. **Synthesizing Conflict:** [Explain the exact logical clash between the Technical momentum and the Risk Manager resistance levels in 1 sentence]
    3. **Correlating On-Chain Flow:** [Explain how exchange stablecoin/token outflows validate or invalidate the price action in 1 sentence]
    4. **Deductive Resolution:** [Detail the specific strategic deduction steps that led you to the final Verdict and Primary Action Trigger in 1-2 sentences]
    
    ### ⚖️ Debate & Consensus:
    [Explain how the technical setups clash with or align with the risks and on-chain movements in a paragraph]
    
    ### 📌 Committee Verdict:
    * **Rating:** [BUY, SELL, or HOLD]
    * **Confidence Score:** [X/10]
    * **Primary Action Trigger:** [One clear price level or signal to wait for before acting]`;

    const userPrompt = `Here are the analysts' arguments:
    
    [Technical Analyst Report]:
    ${techResult.report}
    
    [Risk Manager Report]:
    ${riskResult.report}
    
    [On-Chain Analyst Report]:
    ${chainResult.report}`;

    return await callUnifiedAI(chairmanPrompt, userPrompt);

  } catch (error) {
    console.error("Error in Investment Committee loop:", error);
    throw error;
  }
}

if (require.main === module) {
  runInvestmentCommittee("SOL")
    .then((report) => {
      console.log("\n=================================");
      console.log(report);
      console.log("=================================\n");
    })
    .catch((err) => console.error(err));
}