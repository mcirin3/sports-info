// app/api/scores/route.ts — NBA live scoreboard adapter
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TeamLite = { id: number; name: string; code?: string; logo?: string };
type GameLite = {
  id: string;                 // NBA gameId (string)
  date: string;               // tip time UTC
  season: number;
  status: string;             // "NS" | "Q1".."Q4" | "OT" | "FT"
  period?: number;
  clock?: string;
  home: { team: TeamLite; score: number };
  away: { team: TeamLite; score: number };
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const liveOnly = searchParams.get("live") === "all";

    // NBA live scoreboard for *today*
    const url =
      "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json";

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `NBA ${res.status}: ${text}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const gamesRaw: any[] = json?.scoreboard?.games ?? [];

    let games: GameLite[] = gamesRaw.map(mapNbaGameToGameLite);

    if (liveOnly) {
      const isLive = (g: GameLite) =>
        ["Q1", "Q2", "Q3", "Q4", "OT"].includes(g.status);
      const live = games.filter(isLive);
      games = live.length ? live : games;
    }

    return NextResponse.json({ data: games });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "scores fetch failed" },
      { status: 500 }
    );
  }
}

/* ----------------- helpers ----------------- */

function mapNbaGameToGameLite(g: any): GameLite {
  const gameId: string = g.gameId;
  const season: number = Number(g.season ?? new Date().getFullYear());
  const startTimeUTC: string = g.gameTimeUTC ?? new Date().toISOString();

  const homeRaw = g.homeTeam ?? {};
  const awayRaw = g.awayTeam ?? {};

  const homeTeam: TeamLite = {
    id: Number(homeRaw.teamId),
    name: homeRaw.teamName,
    code: homeRaw.teamTricode,
    logo: `https://cdn.nba.com/logos/nba/${homeRaw.teamId}/global/L/logo.svg`,
  };

  const awayTeam: TeamLite = {
    id: Number(awayRaw.teamId),
    name: awayRaw.teamName,
    code: awayRaw.teamTricode,
    logo: `https://cdn.nba.com/logos/nba/${awayRaw.teamId}/global/L/logo.svg`,
  };

  const homeScore = Number(homeRaw.score ?? 0);
  const awayScore = Number(awayRaw.score ?? 0);

  const gameStatus: number = Number(g.gameStatus ?? 1); // 1 = scheduled, 2 = live, 3 = final
  const period: number = Number(g.period ?? 0);
  const clock: string = String(g.gameClock ?? "");
  const statusText: string = String(g.gameStatusText ?? "");

  let status: string;

  if (gameStatus === 1) {
    status = "NS"; // Not Started
  } else if (gameStatus === 2) {
    // Live
    if (period >= 1 && period <= 4) {
      status = `Q${period}`;
    } else {
      status = "OT";
    }
  } else if (gameStatus === 3) {
    status = "FT"; // Final
  } else {
    // fallback: infer from text
    status = /final/i.test(statusText) ? "FT" : "NS";
  }

  return {
    id: gameId,
    date: startTimeUTC,
    season,
    status,
    period: gameStatus === 2 ? period : undefined,
    clock: gameStatus === 2 ? clock : "",
    home: { team: homeTeam, score: homeScore },
    away: { team: awayTeam, score: awayScore },
  };
}
