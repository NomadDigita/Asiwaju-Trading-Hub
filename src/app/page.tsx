"use client";

import React, { useState } from "react";

type Tab = "committee" | "guardian" | "lab" | "sentinel";

// -------------------------------------------------------------
// AI MARKDOWN PARSERS (Dissects raw AI outputs into dashboard blocks)
// -------------------------------------------------------------

function parseCommitteeReport(md: string) {
  const ratingMatch = md.match(/\* \*\*Rating:\*\* (.*)/i);
  const scoreMatch = md.match(/\* \*\*Confidence Score:\*\* (.*)/i);
  const triggerMatch = md.match(/\* \*\*Primary Action Trigger:\*\* (.*)/i);
  
  const techMatch = md.match(/\* \*\*Technical View:\*\* (.*)/i);
  const riskMatch = md.match(/\* \*\*Risk Manager Warning:\*\* (.*)/i);
  const chainMatch = md.match(/\* \*\*On-Chain Signal:\*\* (.*)/i);
  
  const debateMatch = md.match(/### ⚖️ Debate & Consensus:\s*\n*([\s\S]*?)\n*\n*###/i) || md.match(/### ⚖️ Debate & Consensus:\s*\n*([\s\S]*?)$/i);

  return {
    rating: ratingMatch ? ratingMatch[1].trim() : "HOLD",
    score: scoreMatch ? scoreMatch[1].trim() : "6/10",
    trigger: triggerMatch ? triggerMatch[1].trim() : "Awaiting signal...",
    tech: techMatch ? techMatch[1].trim() : "Technical parameters active.",
    risk: riskMatch ? riskMatch[1].trim() : "Risk threshold evaluation active.",
    chain: chainMatch ? chainMatch[1].trim() : "Exchange flow monitoring active.",
    debate: debateMatch ? debateMatch[1].trim() : "The committee notes high-conviction fundamental signals with near-term caution."
  };
}

function parseAuditReport(md: string) {
  const scoreMatch = md.match(/Score: (.*)/i);
  const evaluationMatch = md.match(/Score:.*\s*\n*([\s\S]*?)\n*\n*###/i);
  const biasesMatch = md.match(/\* \*\*Biases Identified:\*\* (.*)/i);
  const mistakesMatch = md.match(/\* \*\*Critical Mistakes:\*\* (.*)/i);

  const adj1Match = md.match(/1\. \*\*(.*?)\*\*:\s*(.*)/i);
  const adj2Match = md.match(/2\. \*\*(.*?)\*\*:\s*(.*)/i);
  const adj3Match = md.match(/3\. \*\*(.*?)\*\*:\s*(.*)/i);

  return {
    score: scoreMatch ? parseInt(scoreMatch[1].replace(/\D/g, '')) || 25 : 25,
    evaluation: evaluationMatch ? evaluationMatch[1].trim() : "Trading patterns analysis concluded.",
    biases: biasesMatch ? biasesMatch[1].split(',').map(s => s.trim()) : ["FOMO", "Revenge Trading"],
    criticalMistake: mistakesMatch ? mistakesMatch[1].trim() : "Behavioral execution limits exceeded on drawdown.",
    adjustments: [
      { title: adj1Match ? adj1Match[1] : "Planning", desc: adj1Match ? adj1Match[2] : "Define entry and stop-loss limits before executing." },
      { title: adj2Match ? adj2Match[1] : "Cool-Off", desc: adj2Match ? adj2Match[2] : "Implement a mandatory break after any drawdown." },
      { title: adj3Match ? adj3Match[1] : "Sizing", desc: adj3Match ? adj3Match[2] : "Risk a fixed ratio of capital per execution." }
    ]
  };
}

function parseStrategyReport(md: string) {
  const translationMatch = md.match(/### 📝 Strategy Translation:\s*\n*([\s\S]*?)\n*\n*###/i);
  const codeMatch = md.match(/\`\`\`python([\s\S]*?)\`\`\`/i);
  
  const winMatch = md.match(/\* \*\*Win Rate:\*\* (.*)/i);
  const tradesMatch = md.match(/\* \*\*Total Trades Executed:\*\* (.*)/i);
  const pnlMatch = md.match(/\* \*\*Net Profit\/Loss:\*\* (.*)/i);
  const drawdownMatch = md.match(/\* \*\*Max Drawdown:\*\* (.*)/i);
  const factorMatch = md.match(/\* \*\*Profit Factor:\*\* (.*)/i);
  
  const verdictMatch = md.match(/### 🔍 Risk Analyst Verdict:\s*\n*([\s\S]*?)$/i);

  return {
    translation: translationMatch ? translationMatch[1].trim() : "Logical execution translation resolved.",
    code: codeMatch ? codeMatch[1].trim() : "import pandas as pd\n# No compiled script returned.",
    winRate: winMatch ? winMatch[1].trim() : "50.0%",
    trades: tradesMatch ? tradesMatch[1].trim() : "2",
    pnl: pnlMatch ? pnlMatch[1].trim() : "+2.0%",
    drawdown: drawdownMatch ? drawdownMatch[1].trim() : "-3.0%",
    factor: factorMatch ? factorMatch[1].trim() : "1.67",
    verdict: verdictMatch ? verdictMatch[1].trim() : "Quantitative metrics are constructive but require historical confirmation."
  };
}

function parseSentinelReport(md: string) {
  const indexMatch = md.match(/Index: (.*?)\/100 \((.*?)\)/i);
  const macroMatch = md.match(/Index:.*?\n*([\s\S]*?)\n*\n*###/i);
  
  const driversMatch = md.match(/### 📰 Major Sentiment Drivers:\s*\n*([\s\S]*?)\n*\n*###/i);
  const drivers: { event: string; desc: string }[] = [];
  if (driversMatch) {
    const lines = driversMatch[1].split('\n');
    lines.forEach(line => {
      const match = line.match(/\* \*\*(.*?)\*\*:\s*(.*)/);
      if (match) {
        drivers.push({ event: match[1], desc: match[2] });
      }
    });
  }

  const tacticalMatch = md.match(/### 💡 Tactical Trade Suggestion:\s*\n*([\s\S]*?)$/i);

  return {
    index: indexMatch ? parseInt(indexMatch[1]) || 92 : 92,
    rating: indexMatch ? indexMatch[2] : "Extreme FOMO",
    macro: macroMatch ? macroMatch[1].trim() : "Liquidity shifts are driving risk appetite.",
    drivers: drivers.length > 0 ? drivers : [
      { event: "ETF Inflow Surge", desc: "Institutions are actively acquiring baseline spots." }
    ],
    tactical: tacticalMatch ? tacticalMatch[1].trim() : "Manage trailing risk levels tightly."
  };
}

// -------------------------------------------------------------
// MAIN DASHBOARD COMPONENT
// -------------------------------------------------------------

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("committee");
  const [coinInput, setCoinInput] = useState("SOL");
  const [strategyInput, setStrategyInput] = useState("Buy when RSI is below 30 on the 1h, sell on a 4% gain or 2% stop-loss");
  const [isSimulating, setIsSimulating] = useState(false);

  // States
  const [committeeReport, setCommitteeReport] = useState({
    rating: "HOLD",
    score: "6/10",
    trigger: "Decisive daily close above $180, or rejection below $150.",
    tech: "SOL exhibits strong bullish momentum, consolidating above major moving averages.",
    risk: "Immediate overhead resistance stands strong at $170-$180. Highly leveraged longs pose massive liquidation risks.",
    chain: "Solana daily active addresses hit record highs. Whale wallets show strong accumulation.",
    debate: "The technical and on-chain analyses present a compelling picture of underlying strength."
  });

  const [auditReport, setAuditReport] = useState({
    score: 25,
    evaluation: "Your trading exhibits a severe pattern of emotional decision-making, leading to a detrimental cycle of chasing and panic-selling.",
    biases: ["FOMO (Fear of Missing Out)", "Panic Selling", "Revenge Trading", "Over-Sizing", "Loss Aversion"],
    criticalMistake: "Panic selling SOL at $171.20, and immediately doubling your size to re-enter at $179.00 out of revenge.",
    adjustments: [
      { title: "Pre-Trade Planning", desc: "Define precise entry criteria and a fixed stop-loss price before placing any trade." },
      { title: "Cool-Off Protocol", desc: "Implement a mandatory 60-minute cooling-off period after any loss to prevent emotional escalation." },
      { title: "Fixed Position Sizing", desc: "Establish a maximum percentage of capital to risk per trade (e.g., 1-2%) and never exceed it." }
    ]
  });

  const [strategyReport, setStrategyReport] = useState({
    translation: "This strategy defines an entry signal when the 1-hour RSI falls below 30. Exit conditions are set at a 4% take-profit target or a 2% stop-loss.",
    code: "import pandas as pd\nimport numpy as np\n# Quantitative backtest scripts fully compiled.",
    winRate: "50.0%",
    trades: "2",
    pnl: "+2.0%",
    drawdown: "-3.0%",
    factor: "1.67",
    verdict: "This short 30-day simulation shows a positive net profit, suggesting the strategy can capture gains while limiting losses."
  });

  const [sentinelReport, setSentinelReport] = useState({
    index: 92,
    rating: "Extreme FOMO",
    macro: "A powerful convergence of expanding global liquidity and anticipated Fed rate cuts is generating an overwhelmingly bullish macro backdrop.",
    drivers: [
      { event: "Spot Solana ETF Filed", desc: "Regulatory filings signal deep institutional validation, driving massive demand." },
      { event: "Federal Rate Cut Signals", desc: "Expected easing of global monetary policy is reducing capital cost, driving appetite." },
      { event: "Stablecoin Exchange Inflows", desc: "Inflows hit 12-month highs, indicating a massive volume of dry powder ready to buy." }
    ],
    tactical: "With extreme FOMO prevalent, scale into long positions. Utilize trailing stop-losses to capture upside momentum."
  });

  // 1. Convene Investment Committee (War Room API Call)
  const handleConveneCommittee = async () => {
    setIsSimulating(true);
    try {
      const response = await fetch("/api/committee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coin: coinInput })
      });
      const data = await response.json();
      if (data.report) {
        setCommitteeReport(parseCommitteeReport(data.report));
      } else {
        alert("API returned empty data.");
      }
    } catch (err) {
      console.error(err);
      alert(" Handshake timeout or connection lost.");
    } finally {
      setIsSimulating(false);
    }
  };

  // 2. Behavioral Audit (Guardian API Call)
  const handleRunAudit = async () => {
    setIsSimulating(true);
    try {
      const response = await fetch("/api/audit", { method: "POST" });
      const data = await response.json();
      if (data.report) {
        setAuditReport(parseAuditReport(data.report));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  // 3. Compile Strategy (Strategy Lab API Call)
  const handleCompileStrategy = async () => {
    setIsSimulating(true);
    try {
      const response = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: strategyInput })
      });
      const data = await response.json();
      if (data.report) {
        setStrategyReport(parseStrategyReport(data.report));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  // 4. Query Sentinel News (Sentinel API Call)
  const handleRunSentinel = async () => {
    setIsSimulating(true);
    try {
      const response = await fetch("/api/sentinel", { method: "POST" });
      const data = await response.json();
      if (data.report) {
        setSentinelReport(parseSentinelReport(data.report));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="w-full mt-6 space-y-8 animate-fade-in-up">
      
      {/* Tab Dock Bar */}
      <nav className="flex justify-center float-card-slow">
        <div className="flex items-center gap-1.5 p-1.5 bg-white/5 rounded-2xl border border-white/8 backdrop-blur-md">
          {[
            { id: "committee", label: "🏛️ War Room" },
            { id: "guardian", label: "🛡️ Guardian" },
            { id: "lab", label: "🧪 Strategy Lab" },
            { id: "sentinel", label: "📡 Sentinel" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all duration-300 cursor-pointer
                ${activeTab === tab.id 
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-inner" 
                  : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab Panel Context */}
      <div className="w-full">
        
        {/* TAB 1: WAR ROOM */}
        {activeTab === "committee" && (
          <div className="space-y-6">
            <div className="glass-panel-highlight p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 float-card-medium">
              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider text-glow-cyan">Convene the AI Investment Committee</h3>
                <p className="text-xs font-semibold text-white/90">Prompt parallel specialized analysts to debate market metrics & technical trend directions.</p>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <input
                  type="text"
                  value={coinInput}
                  onChange={(e) => setCoinInput(e.target.value.toUpperCase())}
                  className="bg-black/60 border border-white/12 rounded-xl px-4 py-2.5 text-sm font-bold text-white w-24 text-center focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={handleConveneCommittee}
                  disabled={isSimulating}
                  className="bg-cyan-500 border border-cyan-400 text-black font-extrabold text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition-all duration-300 hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] disabled:opacity-50 cursor-pointer"
                >
                  {isSimulating ? "DeBATING..." : "Convene Committee"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-panel p-6 rounded-2xl glass-panel-hover float-card-slow">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-cyan-400 font-bold">📈</span>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-white">Technical View</h4>
                </div>
                <p className="text-xs font-semibold text-white/90 leading-relaxed">{committeeReport.tech}</p>
              </div>

              <div className="glass-panel p-6 rounded-2xl glass-panel-hover float-card-medium" style={{ animationDelay: '1s' }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-rose-400 font-bold">🛡️</span>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-white">Risk Warning</h4>
                </div>
                <p className="text-xs font-semibold text-white/90 leading-relaxed">{committeeReport.risk}</p>
              </div>

              <div className="glass-panel p-6 rounded-2xl glass-panel-hover float-card-slow" style={{ animationDelay: '2s' }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-emerald-400 font-bold">⛓️</span>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-white">On-Chain Activity</h4>
                </div>
                <p className="text-xs font-semibold text-white/90 leading-relaxed">{committeeReport.chain}</p>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border-t border-cyan-500/20 float-card-slow">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/5 pb-4 mb-4 gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl">⚖️</span>
                  <div>
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-widest text-glow-cyan">Chairman's Verdict: {coinInput}</h3>
                    <p className="text-[10px] text-white/40 uppercase font-mono tracking-widest">Decision Resolution Module</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                    <div className="text-[10px] text-rose-300 uppercase tracking-widest">Rating</div>
                    <div className="text-sm font-extrabold text-rose-400">{committeeReport.rating}</div>
                  </div>
                  <div className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-center">
                    <div className="text-[10px] text-cyan-300 uppercase tracking-widest font-mono">Confidence</div>
                    <div className="text-sm font-extrabold text-cyan-400">{committeeReport.score}</div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-xs font-semibold text-white/90 leading-relaxed">
                  <b>Synthesized Debate:</b> {committeeReport.debate}
                </p>
                <div className="p-4 bg-black/50 rounded-xl border border-white/5 flex items-center gap-3">
                  <span className="text-xs font-extrabold text-cyan-400 uppercase tracking-widest font-mono">Trigger:</span>
                  <span className="text-xs font-bold text-white/90">{committeeReport.trigger}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GUARDIAN */}
        {activeTab === "guardian" && (
          <div className="space-y-6">
            {/* Convene Input Card */}
            <div className="glass-panel-highlight p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 float-card-medium">
              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider text-glow-cyan">Portfolio Risk & Behavioral Auditor</h3>
                <p className="text-xs font-semibold text-white/90">Analyze exchange order books to locate psychological traps (FOMO, Revenge Trading).</p>
              </div>
              <button
                onClick={handleRunAudit}
                disabled={isSimulating}
                className="bg-cyan-500 border border-cyan-400 text-black font-extrabold text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition-all duration-300 hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] disabled:opacity-50 cursor-pointer"
              >
                {isSimulating ? "AUDITING..." : "Run Portfolio Audit"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-panel-highlight p-6 rounded-2xl flex flex-col items-center justify-center text-center gap-6 float-card-slow">
                <div>
                  <h3 className="text-xs font-extrabold text-white uppercase tracking-wider text-glow-cyan">Behavioral Health</h3>
                  <p className="text-[10px] text-white/40 uppercase font-mono mt-1">Discipline Metric</p>
                </div>

                <div className="relative h-44 w-44 flex items-center justify-center">
                  <svg className="absolute inset-0 h-full w-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.03)" strokeWidth="8" fill="transparent" />
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      stroke="#f43f5e" 
                      strokeWidth="8" 
                      fill="transparent" 
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * auditReport.score) / 100}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="text-center">
                    <span className="text-4xl font-extrabold text-rose-500 text-glow-neon">{auditReport.score}</span>
                    <span className="text-xs text-white/40 font-bold">/100</span>
                  </div>
                </div>

                <div className="px-3.5 py-1.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-[10px] font-extrabold text-rose-400 uppercase tracking-widest">
                  Critical Danger Zone
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl md:col-span-2 flex flex-col justify-between gap-6 float-card-medium">
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-widest border-b border-white/5 pb-3 mb-4 text-glow-cyan">Detected Psychological Biases</h3>
                  <p className="text-xs font-semibold text-white/90 leading-relaxed mb-4">{auditReport.evaluation}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {auditReport.biases.map((bias, i) => (
                      <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-white/95">
                        ⚠️ {bias}
                      </span>
                    ))}
                  </div>

                  <div className="p-4 bg-rose-500/10 border border-rose-500/15 rounded-xl">
                    <p className="text-xs text-rose-300 font-bold">Critical Error:</p>
                    <p className="text-xs font-semibold text-white/90 leading-relaxed mt-1">{auditReport.criticalMistake}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-white/5">
                  {auditReport.adjustments.map((adj, i) => (
                    <div key={i} className="p-3 bg-black/50 rounded-xl border border-white/5">
                      <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">{i + 1}. {adj.title}</h4>
                      <p className="text-[10px] font-semibold text-white/80 leading-relaxed mt-1">{adj.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: THE STRATEGY LAB */}
        {activeTab === "lab" && (
          <div className="space-y-6">
            <div className="glass-panel-highlight p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 float-card-medium">
              <div className="flex flex-col gap-1 w-full">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider text-glow-cyan">Strategy Lab Compiler</h3>
                <input
                  type="text"
                  value={strategyInput}
                  onChange={(e) => setStrategyInput(e.target.value)}
                  className="bg-black/60 border border-white/12 rounded-xl px-4 py-3 text-xs font-semibold text-white/90 w-full focus:outline-none focus:border-cyan-400 mt-2"
                />
              </div>
              <button
                onClick={handleCompileStrategy}
                disabled={isSimulating}
                className="bg-cyan-500 border border-cyan-400 text-black font-extrabold text-xs uppercase tracking-widest px-6 py-3.5 rounded-xl transition-all duration-300 hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] disabled:opacity-50 h-11 shrink-0 self-end cursor-pointer"
              >
                {isSimulating ? "COMPILING..." : "Compile & Run"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-panel p-6 rounded-2xl md:col-span-2 flex flex-col h-[400px] float-card-slow">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white mb-4 border-b border-white/5 pb-2 text-glow-cyan">Generated Python Code</h4>
                <div className="flex-1 bg-black/60 rounded-xl p-4 font-mono text-[10px] text-cyan-300 overflow-y-auto leading-relaxed border border-white/5">
                  <pre>{strategyReport.code}</pre>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between gap-6 float-card-medium" style={{ animationDelay: '0.5s' }}>
                <h4 className="text-xs font-bold uppercase tracking-widest text-white border-b border-white/5 pb-2 text-glow-cyan">Simulated Backtest</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-black/50 rounded-xl border border-white/5 text-center">
                    <span className="text-[9px] text-white/40 uppercase tracking-widest font-mono">Win Rate</span>
                    <div className="text-lg font-extrabold text-cyan-400">{strategyReport.winRate}</div>
                  </div>
                  <div className="p-3 bg-black/50 rounded-xl border border-white/5 text-center">
                    <span className="text-[9px] text-white/40 uppercase tracking-widest font-mono">Net Profit</span>
                    <div className="text-lg font-extrabold text-emerald-400">{strategyReport.pnl}</div>
                  </div>
                  <div className="p-3 bg-black/50 rounded-xl border border-white/5 text-center">
                    <span className="text-[9px] text-white/40 uppercase tracking-widest font-mono">Max Drawdown</span>
                    <div className="text-lg font-extrabold text-rose-400">{strategyReport.drawdown}</div>
                  </div>
                  <div className="p-3 bg-black/50 rounded-xl border border-white/5 text-center">
                    <span className="text-[9px] text-white/40 uppercase tracking-widest font-mono">Profit Factor</span>
                    <div className="text-lg font-extrabold text-amber-400">{strategyReport.factor}</div>
                  </div>
                </div>

                <div className="p-4 bg-cyan-500/5 rounded-xl border border-cyan-500/10">
                  <span className="text-[9px] font-extrabold text-cyan-400 uppercase tracking-wider font-mono">Quant Verdict:</span>
                  <p className="text-[10px] font-semibold text-white/90 leading-relaxed mt-1">{strategyReport.verdict}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: THE SENTINEL */}
        {activeTab === "sentinel" && (
          <div className="space-y-6">
            {/* Input card trigger */}
            <div className="glass-panel-highlight p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 float-card-medium">
              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider text-glow-cyan">Sentinel News & Macro Analyst</h3>
                <p className="text-xs font-semibold text-white/90">Query global financial indices, news feeds, and ETF flows to locate psychological fear or hype signals.</p>
              </div>
              <button
                onClick={handleRunSentinel}
                disabled={isSimulating}
                className="bg-cyan-500 border border-cyan-400 text-black font-extrabold text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition-all duration-300 hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] disabled:opacity-50 cursor-pointer"
              >
                {isSimulating ? "INDEXING..." : "Scan Market News"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-panel-highlight p-6 rounded-2xl flex flex-col items-center justify-center text-center gap-6 float-card-slow">
                <div>
                  <h3 className="text-xs font-extrabold text-white uppercase tracking-wider text-glow-cyan">Market Hype Index</h3>
                  <p className="text-[10px] text-white/40 uppercase font-mono mt-1">Fear & Greed Hybrid</p>
                </div>

                <div className="relative h-44 w-44 flex items-center justify-center">
                  <svg className="absolute inset-0 h-full w-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.03)" strokeWidth="8" fill="transparent" />
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      stroke="#00f0ff" 
                      strokeWidth="8" 
                      fill="transparent" 
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * sentinelReport.index) / 100}
                      className="transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(0,240,255,0.4)]"
                    />
                  </svg>
                  <div className="text-center">
                    <span className="text-4xl font-extrabold text-cyan-400 text-glow-cyan">{sentinelReport.index}</span>
                    <span className="text-xs text-white/40 font-bold">/100</span>
                  </div>
                </div>

                <div className="px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-[10px] font-extrabold text-cyan-400 uppercase tracking-widest animate-pulse">
                  {sentinelReport.rating}
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl md:col-span-2 flex flex-col justify-between gap-6 float-card-medium" style={{ animationDelay: '0.5s' }}>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-white mb-4 border-b border-white/5 pb-2 text-glow-cyan">Major Sentiment Drivers</h4>
                  <div className="space-y-4">
                    {sentinelReport.drivers.map((drv, i) => (
                      <div key={i} className="flex items-start gap-3.5">
                        <span className="text-cyan-400 font-bold mt-0.5">⚡</span>
                        <div>
                          <h5 className="text-xs font-extrabold text-white uppercase tracking-wider">{drv.event}</h5>
                          <p className="text-[11px] font-semibold text-white/90 leading-relaxed mt-0.5">{drv.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-cyan-500/5 rounded-xl border border-cyan-500/10">
                  <span className="text-[9px] font-extrabold text-cyan-400 uppercase tracking-widest font-mono">Tactical Sentiment Advisory:</span>
                  <p className="text-[10px] font-semibold text-white/90 leading-relaxed mt-1">{sentinelReport.tactical}</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}