"use client";

import { useMemo, useState } from "react";
import WatchHere from "@/components/WatchHere";

const SPORTS = [
  { id: "nba", label: "NBA" },
  { id: "nfl", label: "NFL" },
];

const TEAM_PRESETS: Record<string, string[]> = {
  nba: ["Los Angeles Lakers", "Boston Celtics", "Indiana Pacers", "Denver Nuggets"],
  nfl: ["Kansas City Chiefs", "Dallas Cowboys", "Chicago Bears", "San Francisco 49ers"],
};

export default function WatchPage() {
  const [sport, setSport] = useState("nba");
  const [team, setTeam] = useState("Los Angeles Lakers");
  const [live, setLive] = useState(true);

  const presets = useMemo(() => TEAM_PRESETS[sport] ?? [], [sport]);

  return (
    <div className="space-y-8">
      <section className="card border-white/10 bg-gradient-to-br from-indigo-900/60 via-slate-900/70 to-slate-900/40">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-300">Watch Center</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Game Night Concierge</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300">
          Point it at any team and we build the cleanest stream link available. Designed
          for live game crews in the studio, powered by the `/api/watch` endpoint and
          SWR-driven refresh logic.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Insight label="Sports" value="NBA + NFL" />
          <Insight label="Refresh cadence" value={live ? "15 seconds" : "On demand"} />
          <Insight label="Link origin" value="WATCH_BASE_URL" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_2fr]">
        <article className="glass-panel border-white/5 bg-white/5 space-y-6">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Configure</p>
            <h2 className="text-3xl font-semibold">Build a stream link</h2>
          </header>

          <div className="space-y-3">
            <label className="text-xs uppercase tracking-[0.4em] text-slate-400">
              Sport
            </label>
            <div className="flex flex-wrap gap-3">
              {SPORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSport(s.id)}
                  className={`btn ${
                    sport === s.id ? "btn-primary" : "btn-ghost"
                  } px-5 py-2 text-sm`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="team-input" className="text-xs uppercase tracking-[0.4em] text-slate-400">
              Team name
            </label>
            <input
              id="team-input"
              type="text"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="Indiana Pacers"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white focus:border-sky-400 focus:outline-none"
            />
            <p className="text-xs text-slate-400">
              We slugify this input and append it to the WATCH_BASE_URL host.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">Live tracking</p>
              <p className="text-xs text-slate-400">
                Poll the API every 15 seconds to keep links fresh.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLive((v) => !v)}
              className={`relative inline-flex h-6 w-12 items-center rounded-full transition ${
                live ? "bg-emerald-400/80" : "bg-white/10"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white transition ${
                  live ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Quick picks</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTeam(preset)}
                  className="badge hover:border-white/30 hover:bg-white/10"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </article>

        <div className="space-y-4">
          <WatchHere sport={sport} team={team} live={live} />
          <div className="glass-panel border-white/5 bg-white/5 text-xs uppercase tracking-[0.3em] text-slate-300">
            API call: <code className="mono break-all">/api/watch?sport={sport}&amp;team={encodeURIComponent(team)}</code>
          </div>
        </div>
      </section>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
