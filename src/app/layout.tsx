import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { ReactNode } from "react";

// ✅ Next.js uses this export for the <head> section
export const metadata: Metadata = {
  title: "NBA Scores & Odds",
  description: "Live NBA scores, odds, and matchup insights",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-[color:var(--bg-start)] text-slate-100 antialiased">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="h1">SportsScores & Insights</h1>
            <nav className="flex flex-wrap gap-2">
              <Link className="btn" href="/">Home</Link>
              <Link className="btn" href="/">Scores</Link>
              <Link className="btn" href="/live">Live</Link>
              <Link className="btn" href="/nfl">NFL</Link>
              <Link className="btn" href="/about">About</Link>
            </nav>
          </header>

          {/* Main content */}
          <main>{children}</main>

          <footer className="mt-10 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} NBA Scores & Odds — built with Next.js + Tailwind
          </footer>
        </div>
      </body>
    </html>
  );
}
