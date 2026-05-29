"use client";

import React, { useState, useEffect, useRef } from "react";

const BOOT_LOGS = [
  "▶ [SYSTEM INIT] Initializing Asiwaju AI Hub Core v1.0.0...",
  "▶ [DIRECTORY]  Mapping local configurations & .env parameters...",
  "▶ [GATEWAY]    Pinging Bitget Spot V2 endpoints... Handshake verified. [OK]",
  "▶ [INTELLIGENCE] Linking MuleRun OpenAI-compatible completions nodes... Connected. [OK]",
  "▶ [ORCHESTRATOR] Initializing War Room multi-agent parallel processors... Online. [OK]",
  "▶ [GUARDIAN]    Activating Anti-Liquidator risk auditor diagnostics... Configured. [OK]",
  "▶ [QUANT LAB]   Syncing strategy compiling engines & pandas libraries... Online. [OK]",
  "▶ [SENTINEL]    Engaging global FUD & FOMO sentiment scanners... Listening. [OK]",
  "▶ [STATUS]      ALL SYSTEMS ONLINE. ASIWAJU COMMAND CENTER READY TO COMMENCE."
];

export default function WelcomeCard() {
  const [isOpen, setIsOpen] = useState(true);
  const [displayedLogs, setDisplayedLogs] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bootComplete, setBootComplete] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the terminal logs as they populate
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayedLogs]);

  // Line-by-line boot log simulator
  useEffect(() => {
    if (currentIndex < BOOT_LOGS.length) {
      const delay = currentIndex === 0 ? 600 : Math.random() * 400 + 250;
      const timer = setTimeout(() => {
        setDisplayedLogs((prev) => [...prev, BOOT_LOGS[currentIndex]]);
        setCurrentIndex((prev) => prev + 1);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setBootComplete(true);
    }
  }, [currentIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-2xl transition-all duration-500">
      
      {/* 1. Deep Water Floating Blockchain Particles Backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[20%] left-[15%] h-2 w-2 rounded-full bg-cyan-400/30 blur-[1px] animated-particle" style={{ animationDelay: '0s' }} />
        <div className="absolute top-[60%] left-[25%] h-3 w-3 rounded-full bg-violet-500/20 blur-[1px] animated-particle" style={{ animationDelay: '3s' }} />
        <div className="absolute top-[40%] right-[20%] h-2.5 w-2.5 rounded-full bg-cyan-300/30 blur-[1px] animated-particle" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-[20%] right-[30%] h-3.5 w-3.5 rounded-full bg-indigo-500/20 blur-[1px] animated-particle" style={{ animationDelay: '5s' }} />
        <div className="absolute bottom-[40%] left-[40%] h-2 w-2 rounded-full bg-violet-400/40 blur-[1px] animated-particle" style={{ animationDelay: '2.5s' }} />
      </div>

      {/* Floating background glowing core */}
      <div className="pointer-events-none absolute h-[500px] w-[500px] rounded-full bg-cyan-500/5 blur-[120px] z-0" />

      {/* 2. Brand Ecosystem Logo Header (Pulsing glowing particles) */}
      <div className="flex flex-col items-center justify-center mb-8 z-10 animate-fade-in-up text-center">
        <div className="relative h-20 w-20 flex items-center justify-center mb-3">
          {/* Cyan Glow Layer */}
          <div className="absolute inset-0 rounded-2xl bg-cyan-500/10 blur-xl animate-pulse" />
          
          {/* Futuristic Abstract Blockchain Hexagon Logo */}
          <svg className="h-16 w-16 text-cyan-400 drop-shadow-[0_0_15px_rgba(0,240,255,0.4)]" viewBox="0 0 100 100" fill="none">
            <polygon points="50,15 80,32.5 80,67.5 50,85 20,67.5 20,32.5" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
            <polygon points="50,25 71,37.5 71,62.5 50,75 29,62.5 29,37.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="opacity-60" />
            <circle cx="50" cy="50" r="8" fill="currentColor" />
            {/* Connected node lines */}
            <line x1="50" y1="50" x2="50" y2="15" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
            <line x1="50" y1="50" x2="80" y2="67.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
            <line x1="50" y1="50" x2="20" y2="67.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold tracking-widest text-white text-glow-cyan">
          ASIWAJU <span className="text-cyan-400">AI HUB</span>
        </h2>
        <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono mt-1">Ecosystem Terminal Loader</p>
      </div>

      {/* 3. Refined Enterprise Terminal Window */}
      <div className="relative w-full max-w-2xl glass-panel rounded-2xl overflow-hidden shadow-2xl z-10 border border-white/8 float-card-slow">
        
        {/* Terminal Header Bar */}
        <div className="bg-black/50 px-4 py-3.5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-[9px] font-mono tracking-widest text-white/30 uppercase">
            asiwaju_node_compiler_v1.0.0
          </span>
          <div className="w-12" /> {/* Spacer */}
        </div>

        {/* Clean Diagnostic Body (Stripped out prompt prefixes) */}
        <div className="p-6 h-72 overflow-y-auto font-mono text-[11px] leading-relaxed text-cyan-300 bg-black/60 select-none">
          <div className="space-y-3">
            {displayedLogs.map((log, index) => (
              <div 
                key={index} 
                className="transition-all duration-300 opacity-0 translate-y-1.5 animate-[fade-in-up_0.3s_forwards]"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {log}
              </div>
            ))}
            
            {/* Custom high-contrast block cursor */}
            {!bootComplete && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-3.5 bg-cyan-400 animate-[pulse_0.8s_infinite] inline-block" />
              </div>
            )}
            
            <div ref={terminalEndRef} />
          </div>
        </div>

        {/* Enter CTA Wrapper */}
        <div className="p-4 bg-black/40 border-t border-white/5 flex items-center justify-center">
          <button
            onClick={() => setIsOpen(false)}
            disabled={!bootComplete}
            className={`w-full py-3.5 rounded-xl font-bold tracking-widest text-xs uppercase border transition-all duration-500 flex items-center justify-center gap-2
              ${bootComplete 
                ? "bg-cyan-500 border-cyan-400 text-black cursor-pointer hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(0,240,255,0.4)] active:scale-[0.98]" 
                : "bg-white/5 border-white/5 text-white/10 cursor-not-allowed"
              }`}
          >
            {bootComplete ? (
              <>
                Initialize Command Center
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </>
            ) : (
              "Resolving Neural Node Connections..."
            )}
          </button>
        </div>

      </div>
    </div>
  );
}