"use client";
import useSWR from "swr";

type Team = { id: number; name: string; code: string; logo?: string };
type Game = {
  id: number;
  date: string;
  season: number;
  status: string; // Q1..Q4, OT, FT, etc.
  home: { team: Team; score: number };
  away: { team: Team; score: number };
};
type Payload = { data: Game[] };

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function LivePage() {
  const { data } = useSWR<Payload>("/api/scores?live=all", fetcher, {
    refreshInterval: 12000,
  });
  const games = data?.data ?? [];

  return (
    <main className="space-y-4">
      <h1 className="h1">Live Games</h1>
      {!games.length ? (
        <div className="card text-sm text-slate-300">No live games right now.</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {games.map(g => (
            <a
              key={g.id}
              className="card block hover:bg-white/10 transition"
              href={`/game/${g.id}?home=${g.home.team.id}&away=${g.away.team.id}`}
            >
              <div className="badge bg-green-400/20">{g.status}</div>
              <div className="mt-2 flex items-center justify-between">
                <TeamRow t={g.away.team} score={g.away.score} />
              </div>
              <div className="mt-1 flex items-center justify-between">
                <TeamRow t={g.home.team} score={g.home.score} />
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
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
