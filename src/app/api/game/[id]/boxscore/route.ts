// app/api/game/[id]/boxscore/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // id = NBA gameId from /api/scores

  const url = `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${id}.json`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `NBA boxscore ${res.status}: ${text}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const game = json?.game;

    if (!game) {
      return NextResponse.json(
        { error: "No game data found" },
        { status: 404 }
      );
    }

    // You can pass the raw structure, or normalize it here.
    // Here's a light normalized version that surfaces teams + players.
    const home = game.homeTeam ?? {};
    const away = game.awayTeam ?? {};

    const result = {
      gameId: game.gameId,
      gameStatus: game.gameStatusText,
      period: game.period,
      gameClock: game.gameClock,
      home: {
        teamId: home.teamId,
        name: home.teamName,
        code: home.teamTricode,
        score: Number(home.score ?? 0),
        players: (home.players ?? []).map((p: any) => ({
          personId: p.personId,
          name: p.name,
          position: p.position,
          starter: p.starter,
          minutes: p.statistics?.minutes,
          pts: Number(p.statistics?.points ?? 0),
          reb: Number(p.statistics?.reboundsTotal ?? 0),
          ast: Number(p.statistics?.assists ?? 0),
          stl: Number(p.statistics?.steals ?? 0),
          blk: Number(p.statistics?.blocks ?? 0),
          fgm: Number(p.statistics?.fieldGoalsMade ?? 0),
          fga: Number(p.statistics?.fieldGoalsAttempted ?? 0),
          tpm: Number(p.statistics?.threePointersMade ?? 0),
          tpa: Number(p.statistics?.threePointersAttempted ?? 0),
          ftm: Number(p.statistics?.freeThrowsMade ?? 0),
          fta: Number(p.statistics?.freeThrowsAttempted ?? 0),
        })),
      },
      away: {
        teamId: away.teamId,
        name: away.teamName,
        code: away.teamTricode,
        score: Number(away.score ?? 0),
        players: (away.players ?? []).map((p: any) => ({
          personId: p.personId,
          name: p.name,
          position: p.position,
          starter: p.starter,
          minutes: p.statistics?.minutes,
          pts: Number(p.statistics?.points ?? 0),
          reb: Number(p.statistics?.reboundsTotal ?? 0),
          ast: Number(p.statistics?.assists ?? 0),
          stl: Number(p.statistics?.steals ?? 0),
          blk: Number(p.statistics?.blocks ?? 0),
          fgm: Number(p.statistics?.fieldGoalsMade ?? 0),
          fga: Number(p.statistics?.fieldGoalsAttempted ?? 0),
          tpm: Number(p.statistics?.threePointersMade ?? 0),
          tpa: Number(p.statistics?.threePointersAttempted ?? 0),
          ftm: Number(p.statistics?.freeThrowsMade ?? 0),
          fta: Number(p.statistics?.freeThrowsAttempted ?? 0),
        })),
      },
    };

    return NextResponse.json({ data: result });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "boxscore fetch failed" },
      { status: 500 }
    );
  }
}
