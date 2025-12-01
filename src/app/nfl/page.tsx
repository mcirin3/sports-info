"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { clampNflWeek, getCurrentNflWeek, nflSeasonYearForDate } from "@/lib/nfl";

type Team = { id: number; name: string; logo?: string };
type Game = {
  id: number;
  date: string;
  status: string;
  period?: number;
  clock?: string;
  home: { team: Team; score: number };
  away: { team: Team; score: number };
  tv?: string[];
  gameUrl?: string;
};
type Payload = { data: Game[]; week?: number; season?: number; note?: string };

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

export default function NFLPage() {
  const [week, setWeek] = useState<number>(() => clampNflWeek(getCurrentNflWeek(), 1, 18));
  const [seasonSel] = useState<"current" | "last">("current"); // hook for future toggle
  const seasonBase = useMemo(() => nflSeasonYearForDate(), []);
  const seasonYear =
    seasonSel === "current" ? seasonBase : Math.max(2000, seasonBase - 1);

  const key = useMemo(() => {
    const params = new URLSearchParams({
      week: String(week),
      season: String(seasonYear),
      seasontype: "2",
    });
    return `/api/nfl/scores?${params.toString()}`;
  }, [week, seasonYear]);

  const { data, error, isLoading } = useSWR<Payload>(key, fetcher, {
    refreshInterval: (latest) => {
      const games: Game[] = latest?.data ?? [];
      const anyLive = games.some((g) =>
        ["Q1", "Q2", "Q3", "Q4", "OT"].includes(g.status)
      );
      return anyLive ? 5000 : 30000;
    },
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    isPaused: () => typeof document !== "undefined" && document.hidden,
  });

  const games = data?.data ?? [];
  const up = games.filter((g) => g.status === "NS");
  const live = games.filter((g) =>
    ["Q1", "Q2", "Q3", "Q4", "OT"].includes(g.status)
  );
  const fin = games.filter((g) => g.status === "FT");

  const note = data?.note;
  const statTiles = [
    { label: "Matchups", value: games.length },
    { label: "Live", value: live.length },
    { label: "Final", value: fin.length },
  ];

  return (
    <div className="space-y-8">
      <section className="card border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-emerald-900/40">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-300">
              Season {seasonYear} · Regular
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">NFL Week {week}</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">
              Real-time scoreboard and broadcast guide curated from ESPN&apos;s APIs. Use
              the controls to skim each week of the regular season schedule.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-ghost" onClick={() => setWeek((w) => Math.max(1, w - 1))}>
              ◀ Prev Week
            </button>
            <button className="btn btn-primary" onClick={() => setWeek((w) => Math.min(18, w + 1))}>
              Next Week ▶
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {statTiles.map((tile) => (
            <div key={tile.label} className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                {tile.label}
              </p>
              <p className="mt-2 text-3xl font-semibold">{tile.value}</p>
            </div>
          ))}
        </div>
        {note && (
          <p className="mt-4 text-xs uppercase tracking-[0.4em] text-amber-300/80">
            {note}
          </p>
        )}
      </section>

      {error && <div className="card text-sm text-red-300">Failed to load NFL games.</div>}
      {isLoading && !data && (
        <div className="card text-sm text-slate-300">Loading Week {week} schedule…</div>
      )}

      {!isLoading && !error && games.length === 0 && (
        <div className="card text-sm text-slate-300">
          No games found for Week {week} ({seasonSel} season). Try another week.
        </div>
      )}

      <div className="space-y-6">
        <Section title="Live" games={live} />
        <Section title="Upcoming" games={up} />
        <Section title="Final" games={fin} />
      </div>
    </div>
  );
}

/* ---------- UI helpers ---------- */

function Section({ title, games }: { title: string; games: Game[] }) {
  if (!games.length) return null;
  return (
    <div className="glass-panel border-white/5 bg-white/5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="h2">{title}</h2>
        <span className="pill">{games.length} games</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => (
          <Card key={g.id} g={g} />
        ))}
      </div>
    </div>
  );
}

function Card({ g }: { g: Game }) {
  const isLive = ["Q1", "Q2", "Q3", "Q4", "OT"].includes(g.status);
  const badgeLabel = isLive
    ? `${g.status} • ${g.clock && g.clock !== "0:00" ? g.clock : "—"}`
    : g.status === "NS"
    ? kickoffTime(g.date)
    : "FT";

  const to = `/game/${g.id}?home=${g.home.team.id}&away=${g.away.team.id}`;

  return (
    <div className="card hover:bg-white/10 transition">
      <div className="badge flex items-center gap-2">
        {isLive && <LiveDot />}
        <span>{badgeLabel}</span>
      </div>

      <a href={to} className="block mt-2 no-underline">
        <TeamRow t={g.away.team} s={g.away.score} />
        <TeamRow t={g.home.team} s={g.home.score} />
      </a>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {g.tv?.slice(0, 3).map((n, i) => (
            <span key={i} className="badge">
              {n}
            </span>
          ))}
        </div>
        {g.gameUrl ? (
          <a
            className="btn"
            href={g.gameUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Gamecast
          </a>
        ) : null}
      </div>
    </div>
  );
}

function TeamRow({ t, s }: { t: Team; s: number }) {
  return (
    <div className="mt-1 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {t.logo ? (
          <img
            src={t.logo}
            alt=""
            className="w-6 h-6 rounded-full border border-white/10"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-white/10 border border-white/10" />
        )}
        <span className="font-medium">{t.name}</span>
      </div>
      <span className="text-xl font-bold tabular-nums">{s ?? 0}</span>
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative inline-block w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]">
      <span className="absolute inset-0 rounded-full animate-ping bg-red-500/60" />
    </span>
  );
}

const TZ = "America/Chicago";
function kickoffTime(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    timeZone: TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
