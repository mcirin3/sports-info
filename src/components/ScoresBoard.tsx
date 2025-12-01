"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { espnTeamIds } from "@/lib/teamMap";

type Team = { id: number; name: string; code?: string; logo?: string };
type Game = {
  id: number;
  date: string;
  season: number;
  status: string; // "NS" | "Q1".."Q4" | "OT" | "FT"
  period?: number; // 1..4, OT, undefined when not live
  clock?: string; // "5:32"
  home: { team: Team; score: number };
  away: { team: Team; score: number };
};
type ScoresPayload = { data: Game[] };

const TZ = "America/Chicago";
const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

function todayYMDInTZ(tz = TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

const toEspnId = (team: Team) => (team.code && espnTeamIds[team.code]) ?? team.id;

function tipTime(iso: string, tz = TZ) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatDayNice(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
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
      const anyLive = games.some((g) => ["Q1", "Q2", "Q3", "Q4", "OT"].includes(g.status));
      return anyLive ? 5000 : 30000;
    },
  });

  if (error)
    return (
      <section className="space-y-6">
        <div className="card text-sm text-red-300">Error loading scores.</div>
      </section>
    );
  if (isLoading || !data)
    return (
      <section className="space-y-6">
        <div className="card text-sm text-slate-300">Loading today’s games…</div>
      </section>
    );

  const games = (data.data ?? []) as Game[];
  const { up, live, fin } = groupGames(games);
  const heroDate = formatDayNice(`${today}T00:00:00`);
  const summary = [
    { label: "Total Matchups", value: games.length },
    { label: "Live Now", value: live.length },
    { label: "Finals", value: fin.length },
  ];

  return (
    <div className="space-y-10">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="card border-white/20 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-purple-900/40">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-300">
                Daily Radar · {heroDate}
              </p>
              <h2 className="mt-2 text-4xl font-semibold tracking-tight">
                NBA Matchups Digest
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-slate-300">
                Every game refreshed in real time with ESPN + NBA data, broadcast crews,
                and deep links into the live experience.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Timezone</p>
              <p className="text-lg font-semibold">Central · {TZ}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {summary.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/5 bg-white/5 p-4 shadow-inner shadow-black/20"
              >
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                  {item.label}
                </p>
                <p className="mt-2 text-3xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a className="btn btn-primary" href="/live">
              Jump to Live Mode
            </a>
            <a className="btn btn-ghost" href="/nfl">
              Explore Matchups
            </a>
          </div>
        </article>

        <article className="card border-white/5 bg-gradient-to-b from-indigo-600/30 to-slate-900/80">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-200">
            Watch Guide
          </p>
          <h3 className="mt-3 text-2xl font-semibold">Catch tonight’s best broadcast</h3>
          <p className="mt-2 text-sm text-slate-100/80">
            We surface national TV crews, stream links, and Gamecast data so you know
            where to tune in within seconds.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-slate-200/90">
            <li>• Live refresh every 5s when games are active</li>
            <li>• TV badges from ESPN scoreboard</li>
            <li>• Instant deep links into detailed box scores</li>
          </ul>
          <a className="btn btn-primary mt-6 w-full justify-center" href="/watch">
            Open Watch Center
          </a>
        </article>
      </section>

      <section className="space-y-6">
        <Section title="Live right now" games={live} accent="bg-green-400/20" />
        <Section title="Upcoming tips" games={up} accent="bg-blue-400/20" />
        <Section title="Final buzz" games={fin} accent="bg-slate-400/20" />
      </section>
    </div>
  );
}

function groupGames(games: Game[]) {
  const up: Game[] = [],
    live: Game[] = [],
    fin: Game[] = [];
  for (const g of games) {
    if (g.status === "NS") up.push(g);
    else if (["Q1", "Q2", "Q3", "Q4", "OT"].includes(g.status))
      live.push(g);
    else if (["FT", "AOT"].includes(g.status)) fin.push(g);
  }
  return { up, live, fin };
}

function Section({
  title,
  games,
  accent,
}: {
  title: string;
  games: Game[];
  accent: string;
}) {
  if (!games.length) return null;
  return (
    <div className="glass-panel border-white/5 bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="h2">{title}</h3>
        <span className="pill">{games.length} games</span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => (
          <GameCard key={g.id} g={g} accent={accent} />
        ))}
      </div>
    </div>
  );
}

function GameCard({ g, accent }: { g: Game; accent: string }) {
  const isLive = ["Q1", "Q2", "Q3", "Q4", "OT"].includes(g.status);
  const tipOrClock = isLive
    ? displayLiveClock(g)
    : g.status === "NS"
    ? tipTime(g.date)
    : "FT";

  const to = `/game/${g.id}?home=${toEspnId(g.home.team)}&away=${toEspnId(
    g.away.team
  )}`;

  return (
    <a
      href={to}
      className="card block no-underline hover:bg-white/10 transition"
    >
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
  const periodLabel = g.status === "OT" ? "OT" : g.status;
  const clock = g.clock && g.clock !== "0.0" ? g.clock : "—";
  return `${periodLabel} • ${clock}`;
}

function TeamRow({ t, score }: { t: Team; score: number }) {
  return (
    <div className="flex items-center justify-between w-full">
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
        <div className="font-medium">{t.name}</div>
      </div>
      <div className="text-xl font-bold tabular-nums">
        {score ?? 0}
      </div>
    </div>
  );
}

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
