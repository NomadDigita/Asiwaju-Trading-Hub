"use client";

import React from "react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full px-6 py-4 float-card-slow">
      <div className="mx-auto max-w-7xl glass-panel rounded-2xl px-6 py-3.5 flex items-center justify-between transition-all duration-500 border border-white/8">
        
        {/* Brand Logo & Name (Glowing Cyan Ecosystem Logo) */}
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 flex items-center justify-center">
            {/* Pulsing Glow behind Logo */}
            <div className="absolute inset-0 rounded-xl bg-cyan-500/10 blur-md animate-pulse" />
            
            {/* Hexagon Brand SVG */}
            <svg className="h-8 w-8 text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]" viewBox="0 0 100 100" fill="none">
              <polygon points="50,15 80,32.5 80,67.5 50,85 20,67.5 20,32.5" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
              <polygon points="50,28 69,39 69,61 50,72 31,61 31,39" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="opacity-50" />
              <circle cx="50" cy="50" r="7" fill="currentColor" />
              <line x1="50" y1="50" x2="50" y2="15" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
              <line x1="50" y1="50" x2="80" y2="67.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
              <line x1="50" y1="50" x2="20" y2="67.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
            </svg>
          </div>
          <span className="text-md font-extrabold tracking-widest text-white text-glow-cyan">
            ASIWAJU <span className="text-cyan-400">AI HUB</span>
          </span>
        </div>

        {/* Messaging Bot Links */}
        <div className="flex items-center gap-3">
          
          {/* Telegram Bot Link */}
          <a
            href="https://t.me/AsiwajuTradingBot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-white/5 px-4.5 py-2.5 text-xs font-bold text-white border border-white/5 transition-all duration-300 hover:bg-white/10 hover:border-[#229ED9]/50 hover:text-white hover:scale-105 hover:shadow-[0_0_15px_rgba(34,158,217,0.2)]"
          >
            {/* Exact Telegram SVG */}
            <svg
              className="h-4 w-4 text-[#229ED9]"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.42-1.4-.88.03-.24.36-.49 1.01-.74 3.96-1.72 6.59-2.86 7.91-3.4 3.76-1.54 4.54-1.81 5.05-1.82.11 0 .36.03.52.16.14.11.18.26.19.38.01.12.01.24 0 .36z" />
            </svg>
            Telegram Bot
          </a>

          {/* Discord Bot Link */}
          <a
            href="https://discord.com/oauth2/authorize?client_id=1509519700751810740&permissions=3072&scope=bot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-white/5 px-4.5 py-2.5 text-xs font-bold text-white border border-white/5 transition-all duration-300 hover:bg-white/10 hover:border-[#5865F2]/50 hover:text-white hover:scale-105 hover:shadow-[0_0_15px_rgba(88,101,242,0.2)]"
          >
            {/* Exact Discord SVG */}
            <svg
              className="h-4 w-4 text-[#5865F2]"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M19.27 4.73a1.47 1.47 0 0 0-1-.44c-.37 0-.71.15-.96.39-.75-.41-1.63-.64-2.56-.64s-1.81.23-2.56.64c-.25-.24-.59-.39-.96-.39a1.47 1.47 0 0 0-1.47 1.47c0 .17.03.34.09.5A13.8 13.8 0 0 0 5 13.3c0 3.2 1.83 5.96 4.5 7.37.06-.15.09-.32.09-.5 0-.81-.66-1.47-1.47-1.47-.37 0-.71.15-.96.39a11.8 11.8 0 0 1-2.22-3.8c1.37.91 3.03 1.45 4.81 1.45 1.78 0 3.44-.54 4.81-1.45a11.8 11.8 0 0 1-2.22 3.8c-.25-.24-.59-.39-.96-.39a1.47 1.47 0 0 0-1.47 1.47c0 .18.03.35.09.5 2.67-1.41 4.5-4.17 4.5-7.37a13.8 13.8 0 0 0-3.8-7.03c.06-.16.09-.33.09-.5 0-.81-.66-1.47-1.47-1.47zM9.5 13c-.83 0-1.5-.67-1.5-1.5S8.67 10 9.5 10s1.5.67 1.5 1.5S10.33 13 9.5 13zm5 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
            </svg>
            Discord Bot
          </a>

        </div>

      </div>
    </header>
  );
}