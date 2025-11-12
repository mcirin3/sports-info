"use client";
import useSWR from "swr";

type Team = { id: number; name: string; code?: string; logo?: string };
type Game = {
  id: number;
  date: string;
  season: number;
  status: string;
  home: { team: Team; score: number };
  away: { team: Team; score: number };
};
type Payload = { data: Game[] };

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function EspnBoard() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error, isLoading } = useSWR<Payload>(`/api/espn/scoreboard?date=${today}`, fetcher, {
    refreshInterval: 10000, // 10s for live tests
  });

  if (error) return <div className="card">Error: {String((error as any)?.message ?? error)}</div>;
  if (isLoading || !data) return <div className="card">Loading scoreboard…</div>;

  const games = data.data ?? [];
  const live = games.filter(g => ["Q1","Q2","Q3","Q4","OT"].includes(g.status));
  const up = games.filter(g => g.status === "NS");
  const fin = games.filter(g => g.status === "FT");

  return (
    <main className="space-y-6">
      <h1 className="h1">ESPN – Today’s NBA Scoreboard</h1>

      <Section title="Live" games={live} accent="bg-green-400/20" />
      <Section title="Upcoming" games={up} accent="bg-blue-400/20" />
      <Section title="Final" games={fin} accent="bg-slate-400/20" />
    </main>
  );
}

function Section({ title, games, accent }: { title: string; games: Game[]; accent: string }) {
  if (!games.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="h2">{title}</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {games.map(g => <GameCard key={g.id} g={g} accent={accent} />)}
      </div>
    </section>
  );
}

function GameCard({ g, accent }: { g: Game; accent: string }) {
  const to = `/game/${g.id}?home=${g.home.team.id}&away=${g.away.team.id}`;
  const tipOrStatus = g.status === "NS" ? timeFromISO(g.date) : g.status;

  return (
    <a href={to} className="card block hover:bg-white/10 transition">
      <div className={`badge ${accent}`}>{tipOrStatus}</div>
      <Row t={g.away.team} score={g.away.score} />
      <Row t={g.home.team} score={g.home.score} />
    </a>
  );
}

function Row({ t, score }: { t: Team; score: number }) {
  return (
    <div className="mt-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {t.logo ? (
          <img src={t.logo} alt="" className="w-6 h-6 rounded-full border border-white/10" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-white/10 border border-white/10" />
        )}
        <span className="font-medium">{t.name}</span>
      </div>
      <span className="text-xl font-bold tabular-nums">{score ?? 0}</span>
    </div>
  );
}

function timeFromISO(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
