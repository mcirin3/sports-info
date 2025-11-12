"use client";

import useSWR from "swr";
import { useMemo } from "react";

type Team = { id: number; name: string; code?: string; logo?: string };
type Game = {
  id: number;
  date: string;
  season: number;
  status: string;          // "NS" | "Q1".."Q4" | "OT" | "FT"
  period?: number;         // NEW
  clock?: string;          // NEW "5:32"
  home: { team: Team; score: number };
  away: { team: Team; score: number };
};
type ScoresPayload = { data: Game[] };

const TZ = "America/Chicago";
const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

// "YYYY-MM-DD" in a specific IANA timezone
function todayYMDInTZ(tz = TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}
function tipTime(iso: string, tz = TZ) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(d);
}

export default function ScoresBoard() {
  const today = useMemo(() => todayYMDInTZ(TZ), []);
  const key = `/api/scores?date=${today}&tz=${encodeURIComponent(TZ)}`;

  const { data, error, isLoading } = useSWR<ScoresPayload>(key, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    isPaused: () => typeof document !== "undefined" && document.hidden,
    refreshInterval: (latest) => {
      const games: Game[] = latest?.data ?? [];
      const anyLive = games.some((g) => ["Q1","Q2","Q3","Q4","OT"].includes(g.status));
      return anyLive ? 5000 : 30000;
    },
  });

  if (error) return <main className="space-y-6"><div className="card text-sm text-red-300">Error loading scores.</div></main>;
  if (isLoading || !data) return <main className="space-y-6"><div className="card text-sm text-slate-300">Loading today’s games…</div></main>;

  const games = (data.data ?? []) as Game[];
  const { up, live, fin } = groupGames(games);

  return (
    <main className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="h2">Today’s Games</h2>
        <a className="btn" href="/live">Live</a>
      </div>

      <Section title="Live" games={live} accent="bg-green-400/20" />
      <Section title="Upcoming" games={up} accent="bg-blue-400/20" />
      <Section title="Final" games={fin} accent="bg-slate-400/20" />
    </main>
  );
}

function groupGames(games: Game[]) {
  const up: Game[] = [], live: Game[] = [], fin: Game[] = [];
  for (const g of games) {
    if (g.status === "NS") up.push(g);
    else if (["Q1","Q2","Q3","Q4","OT"].includes(g.status)) live.push(g);
    else if (["FT","AOT"].includes(g.status)) fin.push(g);
  }
  return { up, live, fin };
}

function Section({ title, games, accent }: { title: string; games: Game[]; accent: string }) {
  if (!games.length) return null;
  return (
    <section className="space-y-3">
      <h3 className="h2">{title}</h3>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {games.map((g) => (<GameCard key={g.id} g={g} accent={accent} />))}
      </div>
    </section>
  );
}

function GameCard({ g, accent }: { g: Game; accent: string }) {
  const isLive = ["Q1","Q2","Q3","Q4","OT"].includes(g.status);
  const tipOrClock = isLive
    ? displayLiveClock(g)
    : g.status === "NS"
      ? tipTime(g.date)
      : "FT";

  const to = `/game/${g.id}?home=${g.home.team.id}&away=${g.away.team.id}`;
  return (
    <a href={to} className="card block no-underline hover:bg-white/10 transition">
      <div className={`badge ${accent} flex items-center gap-2`}>
        {isLive && <LiveDot />}
        <span>{tipOrClock}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <TeamRow t={g.away.team} score={g.away.score} />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <TeamRow t={g.home.team} score={g.home.score} />
      </div>
    </a>
  );
}

function displayLiveClock(g: Game) {
  // g.status is "Q1..Q4" or "OT"
  const periodLabel = g.status === "OT" ? "OT" : g.status; // already Q1..Q4/OT
  const clock = g.clock && g.clock !== "0.0" ? g.clock : "—";
  return `${periodLabel} • ${clock}`;
}

function TeamRow({ t, score }: { t: Team; score: number }) {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        {t.logo ? (
          <img src={t.logo} alt="" className="w-6 h-6 rounded-full border border-white/10" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-white/10 border border-white/10" />
        )}
        <div className="font-medium">{t.name}</div>
      </div>
      <div className="text-xl font-bold tabular-nums">{score ?? 0}</div>
    </div>
  );
}

/* ---- tiny live dot ---- */
function LiveDot() {
  return (
    <span
      className="relative inline-block w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
      aria-label="Live"
      title="Live"
    >
      <span className="absolute inset-0 rounded-full animate-ping bg-red-500/60" />
    </span>
  );
}
