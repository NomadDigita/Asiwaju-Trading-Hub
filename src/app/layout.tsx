import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import WelcomeCard from "@/components/WelcomeCard";

export const metadata: Metadata = {
  title: "Asiwaju AI Hub | Trading Command Center",
  description: "Futuristic 4-in-1 AI × Crypto Trading Companion Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="relative min-h-screen w-full bg-[#030206] overflow-x-hidden antialiased">
        
        {/* 1. Animated Liquidglass Backdrops */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] h-[60vw] w-[60vw] rounded-full bg-violet-900/15 blur-[140px] liquid-blob-1" />
          <div className="absolute -bottom-[10%] -right-[10%] h-[50vw] w-[50vw] rounded-full bg-indigo-900/10 blur-[130px] liquid-blob-2" />
          <div className="absolute top-[30%] right-[20%] h-[40vw] w-[40vw] rounded-full bg-fuchsia-950/8 blur-[120px] liquid-blob-3" />
        </div>

        {/* 2. Futuristic Dot-Grid Overlay */}
        <div 
          className="pointer-events-none fixed inset-0 z-0 opacity-40" 
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px)`,
            backgroundSize: '32px 32px'
          }}
        />

        {/* 3. Welcome Bootup Terminal Overlay */}
        <WelcomeCard />

        {/* 4. Global Navbar Header */}
        <Navbar />

        {/* 5. Page Content Wrapper (Padding top pt-24 offsets the fixed header cleanly) */}
        <main className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-24">
          {children}
        </main>

      </body>
    </html>
  );
}