"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";

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
type Payload = { data: Game[] };

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

export default function NFLPage() {
  // 🔢 Start on Week 11 for now
  const [week, setWeek] = useState<number>(11);
  const [seasonSel] = useState<"current" | "last">("current"); // hook for future toggle

  const key = useMemo(
    () => `/api/nfl/scores?week=${week}&season=${seasonSel}&seasontype=2`,
    [week, seasonSel]
  );

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

  return (
    <main className="space-y-6">
      {/* Header + week controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="h1">NFL Week {week}</h1>
          <p className="text-sm text-slate-300">
            Season: {seasonSel === "current" ? "Current" : "Last"} • Regular season
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn"
            onClick={() => setWeek((w) => Math.max(1, w - 1))}
          >
            ◀ Prev Week
          </button>
          <button
            className="btn"
            onClick={() => setWeek((w) => Math.min(25, w + 1))}
          >
            Next Week ▶
          </button>
        </div>
      </div>

      {error && (
        <div className="card text-sm text-red-300">
          Failed to load NFL games.
        </div>
      )}
      {isLoading && !data && (
        <div className="card text-sm text-slate-300">
          Loading Week {week} schedule…
        </div>
      )}

      {!isLoading && !error && games.length === 0 && (
        <div className="card text-sm text-slate-300">
          No games found for Week {week} ({seasonSel} season). Try another week.
        </div>
      )}

      <Section title="Live" games={live} />
      <Section title="Upcoming" games={up} />
      <Section title="Final" games={fin} />
    </main>
  );
}

/* ---------- UI helpers ---------- */

function Section({ title, games }: { title: string; games: Game[] }) {
  if (!games.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="h2">{title}</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {games.map((g) => (
          <Card key={g.id} g={g} />
        ))}
      </div>
    </section>
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
