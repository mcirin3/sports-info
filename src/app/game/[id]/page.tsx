"use client";

import { use } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import MatchupCard from "@/components/MatchupCard";
import WatchHere from "@/components/WatchHere";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const TZ = "America/Chicago";

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  // 👇 unwrap the async params
  const { id } = use(params);

  const search = useSearchParams();
  const homeId = Number(search.get("home"));
  const awayId = Number(search.get("away"));
  const gameId = Number(id);

  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const { data: slate } = useSWR<{ data: any[] }>(
    `/api/scores?date=${date}&tz=${encodeURIComponent(TZ)}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const game = slate?.data?.find((g) => g.id === gameId);

  return (
    <main className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        {/* Optional: show a small live score header */}
        {game ? (
          <div className="card">
            <div className="badge bg-white/10">{game.status}</div>
            <div className="mt-2">
              {game.away.team.name} @ {game.home.team.name}
            </div>
          </div>
        ) : (
          <div className="card text-sm text-slate-300">Loading game info…</div>
        )}
        <WatchHere
          sport="nba"
          team={game?.home?.team?.name || ""}
          live={["Q1","Q2","Q3","Q4","OT"].includes(game?.status || "")}
        />


        <MatchupCard homeId={homeId} awayId={awayId} />
      </div>

      <aside className="space-y-4">
        <div className="card">
          <div className="h2 mb-2">Notes</div>
          <ul className="list-disc pl-5 text-sm text-slate-200/90 space-y-1">
            <li>Params are now unwrapped with React.use().</li>
            <li>Scores auto-refresh every 30 s.</li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
