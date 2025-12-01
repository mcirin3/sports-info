import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { ReactNode } from "react";

const NAV_LINKS = [
  { label: "Dashboard", href: "/" },
  { label: "Live Pulse", href: "/live" },
  { label: "NFL Hub", href: "/nfl" },
  { label: "About", href: "/about" },
];

export const metadata: Metadata = {
  title: "Sports Intelligence Hub",
  description: "Realtime NBA & NFL scores, matchup intel, and watch links",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-transparent text-slate-100 antialiased">
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[-10%] top-[-10%] h-72 w-72 rounded-full bg-sky-500/30 blur-[140px]" />
            <div className="absolute right-[-15%] top-[-5%] h-96 w-96 rounded-full bg-purple-500/20 blur-[160px]" />
            <div className="absolute bottom-[-20%] left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-orange-500/10 blur-[200px]" />
          </div>

          <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
            <header className="glass-panel flex flex-col gap-6 border-white/5 bg-white/5 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-indigo-500 to-purple-500 text-2xl font-semibold shadow-lg shadow-indigo-900/50">
                  SI
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Realtime Studio
                  </p>
                  <p className="text-2xl font-semibold text-white">
                    Sports Intelligence Hub
                  </p>
                  <p className="text-sm text-slate-300">
                    Multi-league live data, odds sentiment, and watchability scores.
                  </p>
                </div>
              </div>
              <nav className="flex flex-wrap gap-2">
                {NAV_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} className="nav-link">
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="flex flex-wrap gap-3">
                <Link href="/watch" className="btn btn-ghost">
                  Watch Guide
                </Link>
                <Link href="/live" className="btn btn-primary">
                  Launch Live Mode
                </Link>
              </div>
            </header>

            <section className="grid gap-3 md:grid-cols-3">
              <article className="glass-panel border-white/5 bg-gradient-to-br from-purple-500/20 to-slate-900/60">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
                  Coverage
                </p>
                <p className="mt-2 text-3xl font-semibold">NBA + NFL</p>
                <p className="text-sm text-slate-300">
                  Full-season tracking with live refresh logic tuned per league.
                </p>
              </article>
              <article className="glass-panel border-white/5 bg-gradient-to-br from-sky-500/20 to-slate-900/60">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
                  Insights
                </p>
                <p className="mt-2 text-3xl font-semibold">Game Intel</p>
                <p className="text-sm text-slate-300">
                  Matchup cards blend box score data, betting signals, and watch links.
                </p>
              </article>
              <article className="glass-panel border-white/5 bg-gradient-to-br from-emerald-500/20 to-slate-900/60">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
                  Tech stack
                </p>
                <p className="mt-2 text-3xl font-semibold">Next.js + SWR</p>
                <p className="text-sm text-slate-300">
                  Edge-friendly APIs with caching strategies for every scoreboard.
                </p>
              </article>
            </section>

            <main className="pb-10">{children}</main>

            <footer className="flex flex-col gap-2 border-t border-white/5 pt-6 text-xs text-slate-400 md:flex-row md:items-center md:justify-between">
              <p>
                © {new Date().getFullYear()} Sports Intelligence Hub · Crafted with Next.js,
                SWR & Tailwind CSS.
              </p>
              <div className="flex gap-3 text-[0.7rem] uppercase tracking-[0.3em]">
                <span>Realtime APIs</span>
                <span>Design Systems</span>
                <span>Data Storytelling</span>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
