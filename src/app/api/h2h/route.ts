// app/api/h2h/route.ts
import { NextRequest, NextResponse } from "next/server";
import { apis } from "@/lib/apisports";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

type ApiGame = {
  id: number;
  teams: { home: { id: number }; away: { id: number } };
  scores: { home: { total: number | null }; away: { total: number | null } };
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const a = Number(searchParams.get("a"));
    const b = Number(searchParams.get("b"));
    const season = Number(searchParams.get("season") ?? new Date().getFullYear());

    if (!a || !b) return jsonError("missing team ids a & b", 400);

    const [A, B] = await Promise.all([teamAverages(a, season), teamAverages(b, season)]);
    const head = await apis<ApiGame[]>("/games/headtohead", { h2h: `${a}-${b}`, league: 12 }, 3600);

    const last10 = (head.response ?? []).slice(-10);
    const aWins = last10.filter(g => {
      const aHome = g.teams.home.id === a;
      const hs = g.scores.home.total ?? 0;
      const as = g.scores.away.total ?? 0;
      return aHome ? hs > as : as > hs;
    }).length;

    return NextResponse.json({
      a: A,
      b: B,
      recent: { games: last10.length, aWins, bWins: last10.length - aWins },
    });
  } catch (e: any) {
    return jsonError(e?.message ?? "h2h failed", 500);
  }
}

async function teamAverages(teamId: number, season: number) {
  const res = await apis<ApiGame[]>("/games", { season, league: 12, team: teamId, per_page: 200 }, 3600);
  const gms = res.response ?? [];
  let scored = 0, allowed = 0, n = 0;

  for (const g of gms) {
    const home = g.teams.home.id === teamId;
    const hs = g.scores.home.total ?? 0;
    const as = g.scores.away.total ?? 0;
    scored += home ? hs : as;
    allowed += home ? as : hs;
    n++;
  }
  n = n || 1;
  const ppg = scored / n;
  const oppg = allowed / n;
  const paceProxy = (scored + allowed) / n;
  return { teamId, ppg, oppg, paceProxy };
}
