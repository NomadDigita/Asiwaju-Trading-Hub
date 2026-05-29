import dotenv from 'dotenv';
dotenv.config();

export async function generateStrategyAndBacktest(prompt: string): Promise<string> {
  const apiKey = process.env.MULERUN_API_KEY;
  if (!apiKey) throw new Error("MULERUN_API_KEY is missing from environment variables.");

  const labPrompt = `You are the Chief Quantitative Strategist and Code Compiler at Asiwaju AI Hub. 
  Your job is to translate the user's natural language trading strategy into structured quantitative logic, 
  generate a clean Python Pandas/Backtesting script, and run a simulated 30-day backtest performance report.
  
  Ensure the Python code is highly clean, uses standard libraries (pandas, numpy), and is ready to run.
  
  You MUST output in this exact markdown format:
  
  ## 🧪 Asiwaju Strategy Lab Report
  *Strategy Requested:* "${prompt}"
  
  ### 📝 Strategy Translation:
  [Briefly translate the user's prompt into formal entry and exit rules in 2-3 sentences]
  
  ### 💻 Generated Python Code:
  \`\`\`python
  # [Python code executing the strategy using pandas]
  \`\`\`
  
  ### 📈 Simulated 30-Day Backtest Performance:
  * **Win Rate:** [X%]
  * **Total Trades Executed:** [X]
  * **Net Profit/Loss:** [e.g., +12.4% or -3.2%]
  * **Max Drawdown:** [e.g., -4.5%]
  * **Profit Factor:** [e.g., 1.8]
  
  ### 🔍 Risk Analyst Verdict:
  [Provide a 2-sentence warning or positive outlook on this strategy's long-term sustainability]`;

  try {
    const response = await fetch('https://api.mulerun.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: labPrompt },
          { role: 'user', content: `Please compile and simulate this strategy: ${prompt}` }
        ],
        stream: false
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "Failed to compile strategy.";
  } catch (error) {
    console.error("Error in Strategy Lab execution:", error);
    throw error;
  }
}

// Self-executing CLI test block
if (require.main === module) {
  generateStrategyAndBacktest("Buy when RSI is below 30 on the 1h chart, and sell when price gains 4% or hits a 2% stop-loss.")
    .then((report) => {
      console.log("\n=================================");
      console.log(report);
      console.log("=================================\n");
    })
    .catch((err) => console.error(err));
}