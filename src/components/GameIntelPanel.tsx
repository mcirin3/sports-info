"use client";

import useSWR from "swr";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function GameIntelPanel({
  gameId,
  homeId,
  awayId,
}: {
  gameId: number;
  homeId: number;
  awayId: number;
}) {
  const { data, error, isLoading } = useSWR(
    `/api/nba/game/${gameId}/intel?home=${homeId}&away=${awayId}&limit=5`,
    fetcher,
    { refreshInterval: 30000 }
  );

  // ⛔ network / fetch error
  if (error) {
    return (
      <div className="card text-red-400">
        Failed to load intel data.
      </div>
    );
  }

  // ⏳ waiting on API
  if (isLoading || !data) {
    return (
      <div className="card text-slate-300">
        Loading matchup insights…
      </div>
    );
  }

  // ⛔ route returned error payload
  if (data.error) {
    return (
      <div className="card text-red-400">
        Error: {data.error}
      </div>
    );
  }

  // ⛔ missing expected structure
  if (!data.home || !data.away) {
    return (
      <div className="card text-yellow-300">
        Insufficient data for matchup insights.
      </div>
    );
  }

  const { home, away, edge } = data;

  return (
    <section className="card space-y-4">
      <h2 className="h2">Matchup Intel</h2>

      {/* Team summaries */}
      <div className="grid md:grid-cols-2 gap-4">
        <TeamBlock title="Home Team" data={home} />
        <TeamBlock title="Away Team" data={away} />
      </div>

      {/* Betting edge */}
      {edge && (
        <div className="mt-4 p-3 rounded-xl bg-white/10 space-y-1">
          <h3 className="font-semibold mb-1">Betting Edge</h3>
          <p className="text-sm text-slate-300">{edge.reason}</p>
          <p className="text-xs text-slate-400 mono">
            Home win chance: {(edge.homeWinProb * 100).toFixed(0)}% · Away win
            chance: {(edge.awayWinProb * 100).toFixed(0)}%
          </p>
        </div>
      )}
    </section>
  );
}

function TeamBlock({ title, data }: { title: string; data: any }) {
  const { avgPF, avgPA, recordLastN, lastNGames } = data;

  const n = typeof lastNGames === "number" ? lastNGames : 0;

  return (
    <div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <ul className="space-y-1 text-sm">
        <li>
          Last {n} record: {recordLastN ?? "—"}
        </li>
        <li>Avg Pts For: {typeof avgPF === "number" ? avgPF.toFixed(1) : "—"}</li>
        <li>
          Avg Pts Allowed:{" "}
          {typeof avgPA === "number" ? avgPA.toFixed(1) : "—"}
        </li>
      </ul>
    </div>
  );
}
