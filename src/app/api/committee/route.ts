import dotenv from 'dotenv';
dotenv.config();

interface AnalystResponse {
  role: string;
  report: string;
}

// Helper to make standardized calls to MuleRun
async function askAnalyst(role: string, systemPrompt: string, coin: string): Promise<AnalystResponse> {
  const apiKey = process.env.MULERUN_API_KEY;
  if (!apiKey) throw new Error("MULERUN_API_KEY is missing from environment variables.");

  const response = await fetch('https://api.mulerun.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze the current market landscape for ${coin.toUpperCase()}.` }
      ],
      stream: false
    })
  });

  const data = await response.json();
  const report = data.choices?.[0]?.message?.content?.trim() || "Failed to generate report.";
  return { role, report };
}

export async function runInvestmentCommittee(coin: string): Promise<string> {
  const coinUpper = coin.toUpperCase();
  console.log(`🎬 Convening the Investment Committee for ${coinUpper}...`);

  // Define specialized system prompts for each agent
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
    // Run the three specialized analysts in parallel for maximum speed
    const [techResult, riskResult, chainResult] = await Promise.all([
      askAnalyst("Technical Analyst", techPrompt, coinUpper),
      askAnalyst("Risk Manager", riskPrompt, coinUpper),
      askAnalyst("On-Chain Analyst", chainPrompt, coinUpper)
    ]);

    console.log(`📊 Reports received. Convening the Chairman to resolve consensus & output Proof of Reasoning...`);

    // The Chairman reads all arguments, logs its step-by-step reasoning steps, and outputs a consensus
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
    1. **Deconstructing Inputs:** [Detail how you isolated the core themes of the analyst reports in 1 sentence]
    2. **Synthesizing Conflict:** [Explain the exact logical clash between the Technical momentum and the Risk Manager resistance levels in 1 sentence]
    3. **Correlating On-Chain Flow:** [Explain how exchange stablecoin/token outflows validate or invalidate the price action in 1 sentence]
    4. **Deductive Resolution:** [Detail the specific strategic deduction steps that led you to the final Verdict and Primary Action Trigger in 1-2 sentences]
    
    ### ⚖️ Debate & Consensus:
    [Explain how the technical setups clash with or align with the risks and on-chain movements in a paragraph]
    
    ### 📌 Committee Verdict:
    * **Rating:** [BUY, SELL, or HOLD]
    * **Confidence Score:** [X/10]
    * **Primary Action Trigger:** [One clear price level or signal to wait for before acting]`;

    const apiKey = process.env.MULERUN_API_KEY;
    const finalResponse = await fetch('https://api.mulerun.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: chairmanPrompt },
          { 
            role: 'user', 
            content: `Here are the analysts' arguments:
            
            [Technical Analyst Report]:
            ${techResult.report}
            
            [Risk Manager Report]:
            ${riskResult.report}
            
            [On-Chain Analyst Report]:
            ${chainResult.report}`
          }
        ],
        stream: false
      })
    });

    const finalData = await finalResponse.json();
    return finalData.choices?.[0]?.message?.content?.trim() || "Failed to generate unified committee report.";

  } catch (error) {
    console.error("Error in Investment Committee loop:", error);
    throw error;
  }
}

// Self-executing CLI test block
if (require.main === module) {
  runInvestmentCommittee("SOL")
    .then((report) => {
      console.log("\n=================================");
      console.log(report);
      console.log("=================================\n");
    })
    .catch((err) => console.error(err));
}